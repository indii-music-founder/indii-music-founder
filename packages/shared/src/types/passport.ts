export interface ProspectAssessment {
  id: string; // UUID v4
  createdAt: number; // ms timestamp
  clientSessionId: string; // Anonymized browser session ID
  careerStage: string; // e.g. 'Just starting out'
  genre: string; // e.g. 'Hip-Hop / Rap'
  customGenre?: string; // Optional custom sound or subgenre description
  proAffiliation: string; // e.g. 'ASCAP' | 'BMI' | 'None'
  mlcRegistered: string; // e.g. 'Yes' | 'No' | 'Not sure'
  distributor: string; // e.g. 'DistroKid' | 'TuneCore'
  releaseStatus: string; // e.g. 'Writing songs' | 'Ready to release'
  goals: string[]; // Up to 2 priority goal IDs
  artistName?: string; // Optional prospect name
  email?: string; // Optional prospect email
  marketingConsent?: boolean; // Explicit affirmative opt-in
  assessmentConsent?: boolean; // Send copy of assessment
  claimedByUid?: string | null; // Set when member account created
  claimedAt?: number | null; // Timestamp when claimed
  reportEmailSentAt?: number | null; // Timestamp when Gap Report email delivered
  reportEmailMessageId?: string | null; // Resend message ID
  source?: string; // Referral acquisition slug
  updatedAt?: number; // Last updated ms
}

export const PASSPORT_FUNNEL_EVENTS = [
  'passport_viewed',
  'passport_started',
  'passport_step_completed',
  'passport_completed',
  'lead_submitted',
  'signup_clicked',
  'freebie_clicked',
] as const;

export type PassportFunnelEventName = typeof PASSPORT_FUNNEL_EVENTS[number];

export interface PassportFunnelEventDetails {
  [key: string]: unknown;
}

export interface PassportFunnelEventRecord {
  eventName: PassportFunnelEventName;
  path: string;
  url: string;
  sessionId: string;
  assessmentId?: string | null;
  details: PassportFunnelEventDetails;
  occurredAtMs: number;
}

