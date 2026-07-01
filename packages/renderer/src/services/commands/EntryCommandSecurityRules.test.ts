import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const rendererCwdPath = resolve(process.cwd(), '../firebase/firestore.rules');
const repoCwdPath = resolve(process.cwd(), 'packages/firebase/firestore.rules');
const rulesPath = existsSync(rendererCwdPath) ? rendererCwdPath : repoCwdPath;
const rules = readFileSync(rulesPath, 'utf8');

describe('Entry command Firestore rules', () => {
  it('defines validation for persisted custom entry commands', () => {
    expect(rules).toContain('function isValidEntryCommand(data, ownerId, scope)');
    expect(rules).toContain('data.slash.matches("^/[a-z][a-z0-9-]{1,31}$")');
    expect(rules).toContain("data.isCustom == true");
    expect(rules).toContain("data.launchMode in ['guided-chat', 'navigate', 'workflow']");
    expect(rules).toContain("data.surfaces.hasOnly(['dashboard', 'command-bar', 'mobile', 'capture', 'voice'])");
  });

  it('protects user-scoped and team-scoped entry command collections', () => {
    expect(rules).toContain('match /entryCommands/{commandId}');
    expect(rules).toContain('match /teamEntryCommands/{commandId}');
    expect(rules).toContain("isValidEntryCommand(request.resource.data, request.auth.uid, 'user')");
    expect(rules).toContain("isValidEntryCommand(request.resource.data, request.auth.uid, 'team')");
    expect(rules).toContain('isOrgMember(resource.data.orgId)');
    expect(rules).toContain('allow delete: if false;');
  });
});
