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

export interface MatchedSpecialist {
  name: string;
  role: string;
  department: string;
  color: string;
  automates: string;
  badge: string;
}

export interface DiagnosticReport {
  rights: RightsObservation;
  release: ReleaseObservation;
  steps: RecommendedStep[];
  matchedSpecialists: MatchedSpecialist[];
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
  { id: 'Grow audience and fan engagement', label: 'Grow fan base, streaming reach & direct-to-fan engagement' },
  { id: 'Plan and market a release', label: 'Plan & coordinate an upcoming multi-week release campaign' },
  { id: 'Organize rights, collaborators, and splits', label: 'Organize collaborator split sheets & legal contracts' },
  { id: 'Pursue sync licensing opportunities', label: 'Package catalog for film, TV & sync licensing opportunities' },
  { id: 'Create promotional content', label: 'Generate 9:16 vertical videos, teasers & social promo assets' },
  { id: 'Better understand music-business finances', label: 'Understand music business finances & master profitability' },
  { id: 'Claim uncollected black-box royalties', label: 'Claim uncollected mechanicals sitting in distributor black-box pools' },
  { id: 'Establish authoritative metadata registry', label: 'Establish verified ISRC, ISWC & UPC metadata records before DSP delivery' },
  { id: 'Audit master audio for streaming compliance', label: 'Audit sound master for loudness (-14 LUFS) & true peak compliance' },
  { id: 'Automate co-producer split payouts', label: 'Automate royalty waterfall payouts for co-producers & bandmates' },
  { id: 'File official copyright registrations', label: 'Register sound recordings & lyrics with the U.S. Copyright Office (eCO)' },
  { id: 'Build editorial pitch & EPK materials', label: 'Build an Electronic Press Kit (EPK) & pitch materials for playlist editors' },
  { id: 'Clear samples and prevent copyright strikes', label: 'Document beat/sample clearance paper trails to avoid automated takedowns' },
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

  // 3. Recommended Top 3 Steps tailored to stage & goals
  const steps: RecommendedStep[] = [];

  if (answers.goals.includes('Organize rights, collaborators, and splits')) {
    steps.push({
      stepNumber: 1,
      title: 'Formalize 100.00% Collaborator Split Agreements',
      detail:
        'Document producer, writer, and feature shares in writing before release delivery. Splits must mathematically sum to 100.00% to avoid distributor royalty holds.',
      department: 'Legal Counsel',
      departmentColor: '#455A64',
    });
  } else if (answers.goals.includes('File official copyright registrations')) {
    steps.push({
      stepNumber: 1,
      title: 'File Official U.S. Copyright Office Registrations',
      detail:
        'Register your master sound recording (Form SR) and underlying compositions (Form PA) with the Library of Congress eCO portal to secure statutory legal protections.',
      department: 'Legal Counsel',
      departmentColor: '#455A64',
    });
  } else if (answers.goals.includes('Claim uncollected black-box royalties')) {
    steps.push({
      stepNumber: 1,
      title: 'Audit & Claim Uncollected Black-Box Mechanical Royalties',
      detail:
        'Run matched catalog queries against The MLC historical unmatched database to reclaim streaming mechanicals deposited before your songs were registered.',
      department: 'Publishing Administrator',
      departmentColor: '#8BC34A',
    });
  } else {
    steps.push({
      stepNumber: 1,
      title: 'Audit Performance & Mechanical Registrations',
      detail:
        'Verify composition titles, IPI/CAE numbers, and ISWC codes across collection societies so public performance and streaming mechanical flows remain uninterrupted.',
      department: 'Publishing Administrator',
      departmentColor: '#8BC34A',
    });
  }

  if (answers.goals.includes('Create promotional content')) {
    steps.push({
      stepNumber: 2,
      title: 'Package 16:9 Master Video into Vertical 9:16 Social Cutdowns',
      detail:
        'Re-slice your landscape studio footage and visualizers into vertical clips for TikTok and Reels to maintain strong brand consistency without restarting from scratch.',
      department: 'Creative Director',
      departmentColor: '#00FF66',
    });
  } else if (answers.goals.includes('Audit master audio for streaming compliance')) {
    steps.push({
      stepNumber: 2,
      title: 'Audit Master Audio for True Peak & DSP Streaming Headroom',
      detail:
        'Analyze audio stems and stereo master for inter-sample clipping (-1.0 dBTP), dynamic range, and -14 LUFS compliance before distributor delivery.',
      department: 'Sonic Director',
      departmentColor: '#FFB800',
    });
  } else if (answers.goals.includes('Clear samples and prevent copyright strikes')) {
    steps.push({
      stepNumber: 2,
      title: 'Compile Sample Provenance & Licensing Documentation',
      detail:
        'Assemble verified receipts, master licensing contracts, and loop declarations into an exportable DSP dispute packet to prevent automated takedowns.',
      department: 'Rights Manager',
      departmentColor: '#00E5FF',
    });
  } else {
    steps.push({
      stepNumber: 2,
      title: 'Establish Your Living Master Directive',
      detail:
        'Define your sound specs, brand color palette, and contractual minimums once so all creative and release materials stay true to your identity.',
      department: 'Conductor Orchestrator',
      departmentColor: '#FFB800',
    });
  }

  if (answers.goals.includes('Pursue sync licensing opportunities')) {
    steps.push({
      stepNumber: 3,
      title: 'Prepare One-Stop Sync Licensing Packages',
      detail:
        'Assemble instrumental, acapella, and clean radio mixes with embedded contact metadata and confirmed 100% master/publishing ownership for rapid sync clearances.',
      department: 'Sync Licensing Specialist',
      departmentColor: '#009688',
    });
  } else if (answers.goals.includes('Automate co-producer split payouts')) {
    steps.push({
      stepNumber: 3,
      title: 'Automate Royalty Waterfall Split Distributions',
      detail:
        'Calculate recoupment thresholds and set up automated net waterfall payouts so co-producers and contributors receive exact percentages on payout day.',
      department: 'Financial Comptroller',
      departmentColor: '#FF7043',
    });
  } else if (answers.goals.includes('Build editorial pitch & EPK materials')) {
    steps.push({
      stepNumber: 3,
      title: 'Assemble Dynamic Electronic Press Kit & Pitch Materials',
      detail:
        'Package high-res press photos, streaming milestones, lyrics, and sonic tags into a live digital press kit for playlist curators and music blogs.',
      department: 'Campaign Publicist',
      departmentColor: '#AB47BC',
    });
  } else {
    steps.push({
      stepNumber: 3,
      title: 'Align Distributor Metadata with Editorial Deadlines',
      detail:
        'Verify ISRC master codes, UPC product barcodes, and lyric credits with your distributor at least 3 weeks before release for playlist pitching.',
      department: 'Distribution Chief',
      departmentColor: '#2196F3',
    });
  }

  // 4. Specialist Team Mapping (Dynamically tailored to chosen goals & career stage)
  const specialistPool: MatchedSpecialist[] = [
    {
      name: 'Publishing Administrator',
      role: 'Dual-Royalty & MLC Verification',
      department: 'Publishing & Royalties',
      color: '#8BC34A',
      automates: 'Scans CMO and MLC registries to ensure mechanical and performance royalties never leak into unclaimed pools.',
      badge: 'RIGHTS PROTECTION',
    },
    {
      name: 'Sonic Director',
      role: 'True Peak & Dynamic Range Verification',
      department: 'Audio Engineering',
      color: '#FFB800',
      automates: 'Inspects WAV masters for inter-sample clipping (-1.0 dBTP), dynamic range, and -14 LUFS DSP streaming standards.',
      badge: 'AUDIO COMPLIANCE',
    },
    {
      name: 'Distribution Chief',
      role: 'DDEX Metadata & Store Packaging',
      department: 'Distribution Operations',
      color: '#2196F3',
      automates: 'Validates ISRC/UPC check digits and packages release metadata into standard DDEX feeds for global DSP delivery.',
      badge: 'CATALOG DELIVERY',
    },
    {
      name: 'Legal Counsel',
      role: 'Collaborator Splits & Contract Review',
      department: 'Legal & Business Affairs',
      color: '#B0BEC5',
      automates: 'Drafts binding split sheets and work-for-hire agreements, mathematically locking co-writer shares to 100.00%.',
      badge: 'LEGAL INFRASTRUCTURE',
    },
  ];

  if (answers.goals.includes('Pursue sync licensing opportunities')) {
    specialistPool.push({
      name: 'Sync Licensing Specialist',
      role: 'Instrumental & Stems Packaging',
      department: 'Sync & Media Licensing',
      color: '#00E5FF',
      automates: 'Builds one-stop clearance packages with clean instrumentals, broadcast wav metadata, and verified master ownership.',
      badge: 'SYNC LICENSING',
    });
  }

  if (answers.goals.includes('Create promotional content')) {
    specialistPool.push({
      name: 'Creative Director',
      role: '9:16 Vertical Video & Teasers',
      department: 'Visual & Social Media',
      color: '#00FF66',
      automates: 'Translates 16:9 studio footage into high-converting 9:16 vertical cutdowns and Spotify Canvas loops.',
      badge: 'VIRAL CONTENT',
    });
  }

  if (
    answers.goals.includes('Better understand music-business finances') ||
    answers.goals.includes('Automate co-producer split payouts')
  ) {
    specialistPool.push({
      name: 'Financial Comptroller',
      role: 'Royalty Waterfall & Payout Automation',
      department: 'Finance & Accounting',
      color: '#FF7043',
      automates: 'Calculates recouped master advances and routes net streaming royalties into automated collaborator split payouts.',
      badge: 'FINANCIAL ACCURACY',
    });
  }

  if (
    answers.goals.includes('Build editorial pitch & EPK materials') ||
    answers.goals.includes('Grow audience and fan engagement')
  ) {
    specialistPool.push({
      name: 'Campaign Publicist',
      role: 'EPK & Curated Playlist Pitching',
      department: 'Marketing & PR',
      color: '#AB47BC',
      automates: 'Synthesizes artist biography, press quotes, and sonic tags into pitch-ready dossiers for DSP editors and tastemakers.',
      badge: 'EDITORIAL REACH',
    });
  }

  const matchedSpecialists = specialistPool.slice(0, 6);

  return { rights, release, steps, matchedSpecialists };
}

