export type RegistrationStatus = 'not_started' | 'in_progress' | 'active' | 'blocked';

export interface RoyaltyProfile {
  id: string;
  userId: string;
  proRegistration: ProRegistrationStatus;
  soundExchangeRegistration: SoundExchangeStatus;
  mlcRegistration: MlcStatus;
  copyrightRegistrations: CopyrightRegistration[];
}

export interface ProRegistrationStatus {
  status: RegistrationStatus;
  selectedPro: 'BMI' | 'ASCAP' | 'SESAC' | null;
  songwriterRegistered: boolean;
  publisherRegistered: boolean;
  ipiNumber: string | null;
  applicationDate: Date | null;
}

export interface SoundExchangeStatus {
  status: RegistrationStatus;
  accountId: string | null;
  registrationDate: Date | null;
  registeredTracks: number;
}

export interface MlcStatus {
  status: RegistrationStatus;
  accountId: string | null;
  ipiNumberLinked: string | null;
  registeredWorks: number;
}

export interface CopyrightRegistration {
  id: string;
  workId: string;
  status: RegistrationStatus;
  registrationNumber: string | null;
}

export interface RegistrationChecklistProps {
  profile: RoyaltyProfile;
  onProSelect?: (pro: 'BMI' | 'ASCAP' | 'SESAC') => void;
  onStatusCheck?: (type: 'pro' | 'soundexchange' | 'mlc' | 'copyright') => void;
  isReleaseGate?: boolean;
}

export const getStatusColor = (status: RegistrationStatus): string => {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'in_progress':
      return 'bg-yellow-500';
    case 'blocked':
      return 'bg-red-500';
    default:
      return 'bg-gray-300';
  }
};

export const getStatusBadge = (status: RegistrationStatus, required: boolean = false): { text: string; className: string } => {
  switch (status) {
    case 'active':
      return { text: 'Complete', className: 'bg-green-100 text-green-800' };
    case 'in_progress':
      return { text: 'In Progress', className: 'bg-yellow-100 text-yellow-800' };
    case 'blocked':
      return { text: 'Blocked', className: 'bg-red-100 text-red-800' };
    default:
      return required 
        ? { text: 'Required', className: 'bg-red-100 text-red-800' }
        : { text: 'Optional', className: 'bg-gray-100 text-gray-600' };
  }
};

export const calculateProgress = (profile: RoyaltyProfile): { completed: number; total: number } => {
  let completed = 0;
  const total = 4;
  
  if (profile.proRegistration.status === 'active') completed++;
  if (profile.soundExchangeRegistration.status === 'active') completed++;
  if (profile.mlcRegistration.status === 'active') completed++;
  if (profile.copyrightRegistrations.some(r => r.status === 'active')) completed++;
  
  return { completed, total };
};
