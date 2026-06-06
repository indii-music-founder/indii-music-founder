import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';
import type { EntryCommandDefinition } from './EntryCommandRegistry';
import {
  getCustomEntryCommands,
  mergeCustomEntryCommands,
  saveCustomEntryCommand,
} from './EntryCommandRegistry';

export type EntryCommandSyncScope = 'user' | 'team';

interface SyncOptions {
  scope?: EntryCommandSyncScope;
  orgId?: string;
}

type PersistedEntryCommand = EntryCommandDefinition & {
  ownerId: string;
  scope: EntryCommandSyncScope;
  orgId?: string;
  updatedAt: number;
};

class EntryCommandSyncService {
  private hydratedKeys = new Set<string>();

  async hydrateCustomCommands(options: SyncOptions = {}): Promise<EntryCommandDefinition[]> {
    const user = auth.currentUser;
    if (!user?.uid) return getCustomEntryCommands();

    const orgId = options.orgId || getCurrentOrganizationId();
    const cacheKey = `${user.uid}:${orgId || 'personal'}`;
    if (this.hydratedKeys.has(cacheKey)) {
      return getCustomEntryCommands();
    }

    const cloudCommands = await this.loadCloudCommands(user.uid, orgId);
    this.hydratedKeys.add(cacheKey);
    if (cloudCommands.length === 0) return getCustomEntryCommands();

    return mergeCustomEntryCommands(cloudCommands);
  }

  async saveCustomCommand(command: EntryCommandDefinition, options: SyncOptions = {}): Promise<{ ok: true; command: EntryCommandDefinition } | { ok: false; reason: string }> {
    const local = saveCustomEntryCommand(command);
    if (!local.ok) return local;

    const user = auth.currentUser;
    if (!user?.uid) {
      return local;
    }

    const orgId = options.orgId || getCurrentOrganizationId();
    const scope: EntryCommandSyncScope = options.scope || inferScope(orgId);

    try {
      await this.saveToUserScope(user.uid, local.command);
      if (scope === 'team' && orgId && orgId !== 'org-default' && orgId !== 'personal') {
        await this.saveToTeamScope(user.uid, orgId, local.command);
      }
    } catch (error) {
      logger.warn('[EntryCommandSyncService] Cloud sync failed; command remains available locally.', error);
    }

    return local;
  }

  private async loadCloudCommands(uid: string, orgId?: string): Promise<EntryCommandDefinition[]> {
    const commands: EntryCommandDefinition[] = [];

    try {
      const userSnapshot = await getDocs(query(
        collection(db, 'entryCommands'),
        where('ownerId', '==', uid),
        where('scope', '==', 'user')
      ));
      userSnapshot.forEach(snapshot => {
        const command = fromPersistedCommand(snapshot.data());
        if (command) commands.push(command);
      });
    } catch (error) {
      logger.warn('[EntryCommandSyncService] Failed to load user entry commands.', error);
    }

    if (orgId && orgId !== 'org-default' && orgId !== 'personal') {
      try {
        const orgSnapshot = await getDocs(query(
          collection(db, 'teamEntryCommands'),
          where('orgId', '==', orgId),
          where('scope', '==', 'team')
        ));
        orgSnapshot.forEach(snapshot => {
          const command = fromPersistedCommand(snapshot.data());
          if (command) commands.push(command);
        });
      } catch (error) {
        logger.warn('[EntryCommandSyncService] Failed to load team entry commands.', error);
      }
    }

    return commands;
  }

  private async saveToUserScope(uid: string, command: EntryCommandDefinition): Promise<void> {
    const payload = toPersistedCommand(command, uid, 'user');
    await setDoc(doc(db, 'entryCommands', buildScopedCommandDocId(uid, command.id)), payload, { merge: true });
  }

  private async saveToTeamScope(uid: string, orgId: string, command: EntryCommandDefinition): Promise<void> {
    const payload = toPersistedCommand(command, uid, 'team', orgId);
    await setDoc(doc(db, 'teamEntryCommands', buildScopedCommandDocId(orgId, command.id)), payload, { merge: true });
  }
}

function getCurrentOrganizationId(): string | undefined {
  return useStore.getState().currentOrganizationId || undefined;
}

function inferScope(orgId?: string): EntryCommandSyncScope {
  return orgId && orgId !== 'org-default' && orgId !== 'personal' ? 'team' : 'user';
}

function buildScopedCommandDocId(scopeId: string, commandId: string): string {
  return `${scopeId}_${commandId}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 140);
}

function toPersistedCommand(
  command: EntryCommandDefinition,
  ownerId: string,
  scope: EntryCommandSyncScope,
  orgId?: string
): PersistedEntryCommand {
  return {
    ...command,
    ownerId,
    scope,
    ...(orgId ? { orgId } : {}),
    updatedAt: Date.now(),
    createdAt: command.createdAt || Date.now(),
  };
}

function fromPersistedCommand(data: unknown): EntryCommandDefinition | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Partial<PersistedEntryCommand>;
  if (!value.isCustom || typeof value.id !== 'string' || typeof value.slash !== 'string') {
    return null;
  }

  return {
    id: value.id,
    slash: value.slash,
    aliases: Array.isArray(value.aliases) ? value.aliases.filter(isString) : [],
    title: typeof value.title === 'string' ? value.title : value.slash,
    summary: typeof value.summary === 'string' ? value.summary : 'Custom command workflow.',
    surfaces: Array.isArray(value.surfaces) ? value.surfaces.filter(isString) as EntryCommandDefinition['surfaces'] : ['command-bar'],
    intakeFields: Array.isArray(value.intakeFields) ? value.intakeFields as EntryCommandDefinition['intakeFields'] : [],
    ...(typeof value.harnessDomain === 'string' ? { harnessDomain: value.harnessDomain as EntryCommandDefinition['harnessDomain'] } : {}),
    ...(typeof value.workflowId === 'string' ? { workflowId: value.workflowId } : {}),
    launchMode: value.launchMode || 'guided-chat',
    outputContract: typeof value.outputContract === 'string' ? value.outputContract : 'Custom command workflow output.',
    approvalRequiredFor: Array.isArray(value.approvalRequiredFor) ? value.approvalRequiredFor.filter(isString) : [],
    resumeBehavior: typeof value.resumeBehavior === 'string' ? value.resumeBehavior : 'Resume saved custom command workflow.',
    isCustom: true,
    ...(typeof value.createdAt === 'number' ? { createdAt: value.createdAt } : {}),
    ...(typeof value.sourceSummary === 'string' ? { sourceSummary: value.sourceSummary } : {}),
  };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export const entryCommandSyncService = new EntryCommandSyncService();
