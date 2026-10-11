export interface ProspectAssessment {
  id: string; // UUID v4
  createdAt: number; // ms timestamp
  clientSessionId: string; // Anonymized browser session ID
  careerStage: string; // e.g. 'Just starting out'
  genre: string; // e.g. 'Hip-Hop / Rap'
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
  source?: string; // Referral acquisition slug
  updatedAt?: number; // Last updated ms
}
