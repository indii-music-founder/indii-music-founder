/**
 * Passport share links — stateless and PII-free.
 *
 * A shared result URL carries only the multiple-choice answers (validated
 * against the option whitelists on decode), never email, contact data, or
 * the Firestore assessment id. The public result page re-runs the
 * deterministic evaluator, so no database read or security-rule change is
 * needed and a crafted link cannot inject arbitrary text.
 */
import {
  CAREER_STAGES,
  DISTRIBUTOR_OPTIONS,
  GENRES,
  GOAL_OPTIONS,
  MLC_OPTIONS,
  PRO_OPTIONS,
  RELEASE_STATUS_OPTIONS,
  evaluatePassport,
  type PassportAnswers,
} from './passportEvaluator';

const VERSION = 1;
const MAX_CUSTOM_GENRE = 40;
const MAX_CODE_LENGTH = 1024;

const ids = (options: ReadonlyArray<{ id: string }>) => new Set(options.map((o) => o.id));
const STAGE_IDS = ids(CAREER_STAGES);
const GENRE_IDS = ids(GENRES);
const PRO_IDS = ids(PRO_OPTIONS);
const MLC_IDS = ids(MLC_OPTIONS);
const DISTRIBUTOR_IDS = ids(DISTRIBUTOR_OPTIONS);
const RELEASE_IDS = ids(RELEASE_STATUS_OPTIONS);
const GOAL_IDS = ids(GOAL_OPTIONS);

interface SharePayload {
  v: number;
  c: string;
  g: string;
  cg?: string;
  p: string;
  m: string;
  d: string;
  r: string;
  o: string[];
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const padded = code.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(code.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function cleanCustomGenre(value: string | undefined): string | undefined {
  // Letters, numbers, spaces and a few separators only — the value is shown on a public page.
  const cleaned = (value ?? '').replace(/[^\p{L}\p{N} &/+'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM_GENRE);
  return cleaned || undefined;
}

export function encodePassportShare(answers: PassportAnswers): string {
  const payload: SharePayload = {
    v: VERSION,
    c: answers.careerStage,
    g: answers.genre,
    p: answers.proAffiliation,
    m: answers.mlcRegistered,
    d: answers.distributor,
    r: answers.releaseStatus,
    o: answers.goals.slice(0, 2),
  };
  const custom = answers.genre === 'Other' ? cleanCustomGenre(answers.customGenre) : undefined;
  if (custom) payload.cg = custom;
  return toBase64Url(JSON.stringify(payload));
}

export function decodePassportShare(code: string | undefined | null): PassportAnswers | null {
  if (!code || code.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<SharePayload>;
  if (p.v !== VERSION) return null;
  const valid =
    typeof p.c === 'string' && STAGE_IDS.has(p.c) &&
    typeof p.g === 'string' && GENRE_IDS.has(p.g) &&
    typeof p.p === 'string' && PRO_IDS.has(p.p) &&
    typeof p.m === 'string' && MLC_IDS.has(p.m) &&
    typeof p.d === 'string' && DISTRIBUTOR_IDS.has(p.d) &&
    typeof p.r === 'string' && RELEASE_IDS.has(p.r) &&
    Array.isArray(p.o) && p.o.length <= 2 && p.o.every((goal) => typeof goal === 'string' && GOAL_IDS.has(goal));
  if (!valid) return null;
  return {
    careerStage: p.c!,
    genre: p.g!,
    customGenre: p.g === 'Other' ? cleanCustomGenre(p.cg) : undefined,
    proAffiliation: p.p!,
    mlcRegistered: p.m!,
    distributor: p.d!,
    releaseStatus: p.r!,
    goals: [...new Set(p.o as string[])],
  };
}

export function buildPassportShareUrl(answers: PassportAnswers, origin: string = window.location.origin): string {
  return `${origin}/passport/r/${encodePassportShare(answers)}`;
}

export function stageFor(careerStage: string): { badge: string; title: string } {
  const stage = CAREER_STAGES.find((s) => s.id === careerStage);
  return { badge: stage?.badge ?? 'PASSPORT', title: stage?.title ?? careerStage };
}

/** Share-card template for a Passport result (see @shared/share). */
/** The printed link is the short invite (`indii.music/passport`); the full result link travels in the share text. */
export function passportCardTemplate(answers: PassportAnswers, origin: string = window.location.origin) {
  const stage = stageFor(answers.careerStage);
  return {
    kind: 'passport' as const,
    stageBadge: stage.badge,
    stageTitle: stage.title,
    finding: evaluatePassport(answers).rights.title,
    url: `${origin}/passport`,
  };
}
