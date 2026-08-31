import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface InvitationQueueResult {
  queued: boolean;
  alreadyQueued: boolean;
  communicationId?: string;
  artistUid?: string;
  email?: string;
  queuePosition?: number;
  reason?: 'no_eligible_artist';
}

export interface MilestoneCampaignResult {
  campaignId: string;
  recipientCount: number;
  alreadyQueued: boolean;
}

export async function inviteNextFoundingArtist(): Promise<InvitationQueueResult> {
  const callable = httpsCallable<Record<string, never>, InvitationQueueResult>(
    functions,
    'inviteNextFoundingArtist',
  );
  return (await callable({})).data;
}

export async function queueFoundingArtistMilestoneUpdate(
  subject: string,
  message: string,
  requestId: string = crypto.randomUUID(),
): Promise<MilestoneCampaignResult> {
  const callable = httpsCallable<
    { requestId: string; subject: string; message: string },
    MilestoneCampaignResult
  >(functions, 'queueFoundingArtistMilestoneUpdate');
  return (await callable({ requestId, subject, message })).data;
}
