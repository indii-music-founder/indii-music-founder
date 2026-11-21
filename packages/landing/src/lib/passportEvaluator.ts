export interface PassportAnswers {
  careerStage: string;
  genre: string;
  customGenre?: string;
  proAffiliation: string;
  mlcRegistered: string;
  distributor: string;
  releaseStatus: string;
  goals: string[];
}

export interface RightsObservation {
  status: 'good' | 'warning' | 'notice';
  title: string;
  description: string;
  actionRecommendation: string;
}

export interface ReleaseObservation {
  status: 'info' | 'ready';
  title: string;
  guidelines: string[];
}

export interface RecommendedStep {
  stepNumber: number;
  title: string;
  detail: string;
  department: string;
  departmentColor: string;
}

export interface DiagnosticReport {
  rights: RightsObservation;
  release: ReleaseObservation;
  steps: RecommendedStep[];
}

export const CAREER_STAGES = [
  {
    id: 'Just starting out',
    title: 'Just starting out',
    desc: 'Preparing my first official drops, establishing my sound and initial creator accounts.',
    badge: 'STAGE 01',
  },
  {
    id: 'Building momentum',
    title: 'Building momentum',
    desc: 'Releasing consistently, building an active listener base, needing repeatable business structure.',
    badge: 'STAGE 02',
  },
  {
    id: 'Established independent artist',
    title: 'Established independent artist',
    desc: 'Active catalog, steady streaming and show revenue, managing a growing operational load.',
    badge: 'STAGE 03',
  },
  {
    id: 'Rebooting / Starting fresh',
    title: 'Rebooting / Starting fresh',
    desc: 'Had a past career or releases, took time off for life, and returning now to start anew on my own terms.',
    badge: 'STAGE 04',
  },
  {
    id: 'Producer / Songwriter stepping forward',
    title: 'Producer / Songwriter stepping forward',
    desc: 'Seasoned background collaborator, beatmaker, or composer now releasing under my own artist identity.',
    badge: 'STAGE 05',
  },
  {
    id: 'Industry veteran / Catalog owner',
    title: 'Industry veteran / Catalog owner',
    desc: 'Substantial back catalog, complex rights, managing multiple collaborators, masters, and legacy entities.',
    badge: 'STAGE 06',
  },
];

export const GENRES = [
  { id: 'Hip-Hop / Rap', label: 'Hip-Hop / Rap' },
  { id: 'House & Techno', label: 'House & Techno' },
  { id: 'R&B / Soul', label: 'R&B / Soul' },
  { id: 'Electronic / Dance', label: 'Electronic / Dance / Bass' },
  { id: 'Indie / Alternative', label: 'Indie / Alternative' },
  { id: 'Rock / Metal / Punk', label: 'Rock / Metal / Punk' },
  { id: 'Pop', label: 'Pop' },
  { id: 'Country / Americana / Folk', label: 'Country / Americana / Folk' },
  { id: 'Afrobeats / Reggae', label: 'Afrobeats / Reggae / Dancehall' },
  { id: 'Latin / Reggaeton', label: 'Latin / Reggaeton' },
  { id: 'Jazz / Classical / Instrumental', label: 'Jazz / Classical / Instrumental' },
  { id: 'Other', label: 'Other / Custom Sound' },
];

export const PRO_OPTIONS = [
  { id: 'ASCAP', label: 'ASCAP' },
  { id: 'BMI', label: 'BMI' },
  { id: 'SESAC', label: 'SESAC' },
  { id: 'PRS / SOCAN / International', label: 'PRS / SOCAN / International CMO' },
  { id: 'None', label: 'Not affiliated with a PRO yet' },
  { id: 'Not sure', label: 'Not sure if I am registered' },
];

export const MLC_OPTIONS = [
  { id: 'Yes', label: 'Yes — my compositions are registered with The MLC' },
  { id: 'No', label: 'No — not registered with The MLC' },
  { id: 'Not sure', label: 'Not sure what The MLC is or if I am registered' },
  { id: 'Not applicable', label: 'Not applicable / based outside US streaming distribution' },
];

export const DISTRIBUTOR_OPTIONS = [
  { id: 'DistroKid', label: 'DistroKid' },
  { id: 'TuneCore', label: 'TuneCore' },
  { id: 'CD Baby', label: 'CD Baby' },
  { id: 'Symphonic', label: 'Symphonic' },
  { id: 'UnitedMasters', label: 'UnitedMasters' },
  { id: 'AWAL', label: 'AWAL / Downtown' },
  { id: 'Self-distribute', label: 'Self-distribute directly (Bandcamp, web)' },
  { id: 'Not distributing yet', label: 'Not distributing yet / Planning first drop' },
];

export const RELEASE_STATUS_OPTIONS = [
  { id: 'Still creating / producing', label: 'Still writing, producing, or arranging tracks' },
  { id: 'Mixing or mastering', label: 'Audio is in mixing or final mastering stages' },
  { id: 'Finished audio, preparing release', label: 'Master WAVs ready; preparing artwork, splits, and metadata' },
  { id: 'Already released / managing catalog', label: 'Already out; managing active catalog and rollout campaigns' },
];

export const GOAL_OPTIONS = [
  { id: 'Improve royalty registration and tracking', label: 'Improve royalty registration & collection tracking' },
  { id: 'Grow audience and fan engagement', label: 'Grow my fanbase and streaming audience' },
  { id: 'Plan and market a release', label: 'Plan and run a release campaign' },
  { id: 'Organize rights, collaborators, and splits', label: 'Organize collaborator splits and contracts' },
  { id: 'Pursue sync licensing opportunities', label: 'Get my music ready for film, TV and sync licensing' },
  { id: 'Create promotional content', label: 'Make short vertical videos and promo assets' },
  { id: 'Better understand music-business finances', label: 'Understand my music income and expenses' },
  { id: 'Claim uncollected black-box royalties', label: 'Find royalties I may not have collected yet' },
  { id: 'Establish authoritative metadata registry', label: 'Get song and release IDs in order before delivery (ISRC, UPC)' },
  { id: 'Audit master audio for streaming compliance', label: 'Check that my masters meet streaming loudness standards' },
  { id: 'Automate co-producer split payouts', label: 'Pay co-producers and bandmates their share' },
  { id: 'File official copyright registrations', label: 'Register my recordings and lyrics with the U.S. Copyright Office' },
  { id: 'Build editorial pitch & EPK materials', label: 'Build a press kit and pitch materials for playlist editors' },
  { id: 'Clear samples and prevent copyright strikes', label: 'Keep sample clearance records to avoid takedowns' },
];

export const INITIAL_ANSWERS: PassportAnswers = {
  careerStage: '',
  genre: '',
  customGenre: '',
  proAffiliation: '',
  mlcRegistered: '',
  distributor: '',
  releaseStatus: '',
  goals: [],
};

export function evaluatePassport(answers: PassportAnswers): DiagnosticReport {
  // 1. Rights & Royalties Evaluation
  let rights: RightsObservation;
  const hasPRO =
    answers.proAffiliation &&
    answers.proAffiliation !== 'None' &&
    answers.proAffiliation !== 'Not sure';
  const hasMLC = answers.mlcRegistered === 'Yes';
  const mlcGap = answers.mlcRegistered === 'No' || answers.mlcRegistered === 'Not sure';

  if (hasPRO && mlcGap) {
    rights = {
      status: 'warning',
      title: 'Possible Streaming Mechanical Collection Gap',
      description: `You are affiliated with ${answers.proAffiliation} for performance royalties. However, digital mechanical royalties generated from on-demand streaming in the US (Spotify, Apple Music, Amazon) require separate registration through The MLC.`,
      actionRecommendation:
        'Your answers suggest a possible registration or collection gap worth investigating. Registering your eligible catalog with The MLC ensures digital mechanicals are collected.',
    };
  } else if (answers.proAffiliation === 'None' || answers.proAffiliation === 'Not sure') {
    rights = {
      status: 'warning',
      title: 'Performance Rights Registration Gap',
      description:
        'Without affiliation with a Performing Rights Organization (ASCAP, BMI, SESAC, or international equivalent), public performance royalties generated when your music is played on radio, venues, and streaming cannot be collected.',
      actionRecommendation:
        'Affiliate with a PRO to establish your songwriter IPI number and begin registering your musical compositions.',
    };
  } else if (hasPRO && hasMLC) {
    rights = {
      status: 'good',
      title: 'Dual-Royalty Foundation Established',
      description: `You have both a PRO (${answers.proAffiliation}) and The MLC configured, covering both performance royalties and digital mechanical streaming royalties in the US.`,
      actionRecommendation:
        'Keep collaborator split sheets locked at exactly 100% before distribution delivery to prevent metadata freezes across databases.',
    };
  } else {
    rights = {
      status: 'notice',
      title: 'Rights & Territory Registration Overview',
      description:
        'Depending on your territory and distribution footprint, ensuring performance and mechanical rights registrations are aligned prevents unallocated royalties from sitting in black-box pools.',
      actionRecommendation:
        'Verify your writer and publisher shares across your local collection management organizations.',
    };
  }

  // 2. Release & Technical Guidelines
  const isPendingDrop =
    answers.releaseStatus === 'Mixing or mastering' ||
    answers.releaseStatus === 'Finished audio, preparing release';

  const release: ReleaseObservation = {
    status: isPendingDrop ? 'ready' : 'info',
    title: isPendingDrop ? 'Active Release Technical Preparation' : 'Release Pipeline & Catalog Health',
    guidelines: [
      'Audio Dynamic Range: Maintain clean peak headroom (-1.0 dB True Peak) to avoid inter-sample clipping when DSPs transcode audio. Spotify playback normalization (-14 LUFS) is a playback reference, not a dynamic brickwall ceiling.',
      'Artwork Standards: Provide uncompressed 3000 × 3000 px 24-bit RGB square artwork to meet current high-resolution distributor guidelines.',
      'Pitch Window Best Practice: While DSPs accept submissions close to release, scheduling a 3–4 week buffer allows proper editorial consideration and pre-save campaign buildup.',
    ],
  };

  // Explicit priorities win, in selection order; observations fill the remaining slot.
  const recommendations: Record<string, [string, string, string]> = {
    'Improve royalty registration and tracking': ['Review royalty collection coverage', 'Compare your catalog credits and registration status with the organizations relevant to your territory and rights.', 'Publishing Administrator'],
    'Grow audience and fan engagement': ['Build direct fan relationships', 'Choose one audience channel, invite listeners to an owned mailing list with consent, and track engagement over your next campaign.', 'Campaign Publicist'],
    'Plan and market a release': ['Build your release calendar', 'Set a release date and work backward through artwork, credits, distributor requirements, and promotional milestones.', 'Campaign Publicist'],
    'Organize rights, collaborators, and splits': ['Document collaborator splits', 'Agree writer and master shares with collaborators and record each agreement before release.', 'Legal Counsel'],
    'Pursue sync licensing opportunities': ['Prepare a sync pitch package', 'Gather clean and instrumental versions, accurate credits, contact details, and evidence of the rights you can license.', 'Sync Licensing Specialist'],
    'Create promotional content': ['Prepare your promotional assets', 'Choose a song excerpt and make a practical plan for vertical clips, artwork, captions, and posting dates.', 'Creative Director'],
    'Better understand music-business finances': ['Organize music income and expenses', 'Record distributor receipts, show income, merchandise costs, and collaborator obligations in a monthly ledger.', 'Financial Comptroller'],
    'Claim uncollected black-box royalties': ['Investigate unmatched royalty records', 'Check whether your works appear in applicable unmatched databases; confirm ownership and eligibility before submitting a claim.', 'Publishing Administrator'],
    'Establish authoritative metadata registry': ['Organize your recording and work identifiers', 'Record available ISRC, ISWC, and UPC identifiers alongside titles, writers, performers, and release credits.', 'Distribution Chief'],
    'Audit master audio for streaming compliance': ['Review your master against delivery requirements', 'Check clipping, true peak, file format, and your distributor’s current specifications. Loudness normalization is not a universal acceptance threshold.', 'Sonic Director'],
    'Automate co-producer split payouts': ['Document the payout calculation', 'Agree shares, costs, recoupment, and payment responsibilities before using a payout workflow; verify actual payment support separately.', 'Financial Comptroller'],
    'File official copyright registrations': ['Prepare copyright registration materials', 'Gather ownership details and deposit materials, then review the official filing requirements for your jurisdiction.', 'Legal Counsel'],
    'Build editorial pitch & EPK materials': ['Build your EPK and pitch materials', 'Gather a short biography, press photos, listening links, live footage, and booking contact. Include only verified milestones.', 'Campaign Publicist'],
    'Clear samples and prevent copyright strikes': ['Document sample permissions', 'Gather licenses and agreements and review permitted uses before release. Documentation cannot guarantee prevention of a takedown.', 'Rights Manager'],
  };
  const steps: RecommendedStep[] = [];
  const addStep = (title: string, detail: string, department: string) => {
    if (steps.length < 3 && !steps.some(step => step.title === title)) {
      steps.push({ stepNumber: steps.length + 1, title, detail, department, departmentColor: '#FFB800' });
    }
  };
  for (const goal of answers.goals.slice(0, 2)) {
    const step = recommendations[goal];
    if (step) addStep(...step);
  }
  if (rights.status !== 'good') addStep('Review your rights registration status', rights.actionRecommendation, 'Publishing Administrator');
  if (answers.releaseStatus === 'Already released / managing catalog') {
    addStep('Review your active catalog', 'Reconcile titles, credits, identifiers, and release links with your distributor records.', 'Distribution Chief');
  } else {
    addStep('Prepare the next release milestone', 'Review artwork, credits, splits, dates, and current distributor delivery requirements.', 'Distribution Chief');
  }
  addStep('Choose one achievable business task', 'Set a task, an owner, and a completion date based on your current priorities.', 'Conductor Orchestrator');
  addStep('Organize your project records', 'Gather credits, agreements, assets, and release links in one place before starting the next task.', 'Conductor Orchestrator');

  return { rights, release, steps };
}

