/**
 * liveConfig — reads from the environment which platform the live-contract checks run against, if any.
 *
 * Why: the live-contract seam runs only when asked (D-101's amendment of 2026-11-05): the `LIVE_CANVAS_*` variables
 *      name ALU's test Canvas, `LIVE_FEIDE_ISSUER` names real Feide, and `LIVE_TARGET=mock` runs the same checks
 *      against the mock platform. With none of them every check is skipped. A Canvas target set only in part is a
 *      mistake, so it fails at once and names what is missing instead of skipping quietly.
 * Spec: LTI-008, LTI-012, AUTH-001
 * Invariants:
 *   - Pure: reads only the record it is given; no value read here is ever logged or put into an error message, only
 *     variable names.
 *   - `LIVE_TARGET=mock` together with a Canvas or Feide target is refused: the mock run writes test rows into the
 *     local database and must never be confused with a run against the test server.
 *   - Canvas and Feide URLs must use https; the mock target needs none.
 *   - The label mode defaults to `suffix`, as `AGS_LABEL_MODE` does (D-105).
 * Collaborators: ./canvasTarget.ts, ./mockCanvasTarget.ts, the `*.live.test.ts` files, ./vitest.live.config.ts.
 * Tests: apps/server/live/liveConfig.test.ts
 */
import {
  AGS_LABEL_MODES,
  DEFAULT_AGS_LABEL_MODE,
  type AgsLabelMode,
} from '../src/lti/deepLinking/formativeLabel.js';

/** What the Canvas checks need to know about ALU's test Canvas and the test server registered there. */
export interface LiveCanvasSettings {
  /** `LIVE_CANVAS_ISSUER`: the platform's `iss`, e.g. `https://canvas.test.instructure.com`. */
  readonly issuer: string;
  /** `LIVE_CANVAS_CLIENT_ID`: the developer key's client ID. */
  readonly clientId: string;
  /** `LIVE_CANVAS_API_ORIGIN`: the institution domain AGS and NRPS answer on, e.g. `https://hvl.test.instructure.com`. */
  readonly apiOrigin: string;
  /** `LIVE_CANVAS_COURSE_ID`: Canvas's ID of the test course. */
  readonly courseId: string;
  /** `LIVE_DATABASE_URL`: the test server's database, read for the platform row and its tool key only. */
  readonly databaseUrl: string;
  /** `LIVE_DATA_ENCRYPTION_KEYS`: the test server's `DATA_ENCRYPTION_KEYS`, to decrypt the tool key (D-056). */
  readonly dataEncryptionKeys: string;
  /** `LIVE_CANVAS_STUDENT_SUB`: a test student's LTI `sub`; without it no score is posted. */
  readonly studentSub: string | undefined;
  /** `LIVE_AGS_LABEL_MODE`: the test server's `AGS_LABEL_MODE`, which decides the label the line item must carry. */
  readonly labelMode: AgsLabelMode;
}

/** Where the checks run: nowhere, against the mock platform, or against the real services that are named. */
export type LivePlan =
  | { readonly kind: 'none' }
  | { readonly kind: 'mock' }
  | {
      readonly kind: 'live';
      readonly canvas: LiveCanvasSettings | undefined;
      /** `LIVE_FEIDE_ISSUER`, e.g. `https://auth.dataporten.no`. */
      readonly feideIssuer: string | undefined;
    };

/** A live configuration that cannot be used; the message names variables, never their values. */
export class LiveConfigError extends Error {
  /**
   * @param message - What is wrong, naming the variables involved.
   */
  constructor(message: string) {
    super(`${message} (see apps/server/live/README.md)`);
    this.name = 'LiveConfigError';
  }
}

/** The variables a Canvas target needs; `LIVE_CANVAS_STUDENT_SUB` and `LIVE_AGS_LABEL_MODE` are optional. */
export const CANVAS_VARIABLES = [
  'LIVE_CANVAS_ISSUER',
  'LIVE_CANVAS_CLIENT_ID',
  'LIVE_CANVAS_API_ORIGIN',
  'LIVE_CANVAS_COURSE_ID',
  'LIVE_DATABASE_URL',
  'LIVE_DATA_ENCRYPTION_KEYS',
] as const;

type Environment = Readonly<Record<string, string | undefined>>;

const valueOf = (env: Environment, name: string): string | undefined => {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
};

/** An https origin or URL, or an error naming the variable. */
function httpsUrl(env: Environment, name: string, originOnly: boolean): string {
  const value = valueOf(env, name) ?? '';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LiveConfigError(`${name} is not a URL`);
  }
  if (url.protocol !== 'https:') throw new LiveConfigError(`${name} must use https`);
  if (originOnly && url.href !== `${url.origin}/`)
    throw new LiveConfigError(`${name} must be an origin only`);
  return originOnly ? url.origin : value.replace(/\/$/, '');
}

function canvasSettings(env: Environment): LiveCanvasSettings | undefined {
  const named = [...CANVAS_VARIABLES, 'LIVE_CANVAS_STUDENT_SUB', 'LIVE_AGS_LABEL_MODE'].filter((name) =>
    valueOf(env, name),
  );
  if (named.length === 0) return undefined;
  const missing = CANVAS_VARIABLES.filter((name) => valueOf(env, name) === undefined);
  if (missing.length > 0) throw new LiveConfigError(`a Canvas target also needs ${missing.join(', ')}`);
  const labelMode = valueOf(env, 'LIVE_AGS_LABEL_MODE') ?? DEFAULT_AGS_LABEL_MODE;
  if (!(AGS_LABEL_MODES as readonly string[]).includes(labelMode)) {
    throw new LiveConfigError(`LIVE_AGS_LABEL_MODE must be one of ${AGS_LABEL_MODES.join(', ')}`);
  }
  return {
    issuer: httpsUrl(env, 'LIVE_CANVAS_ISSUER', false),
    clientId: valueOf(env, 'LIVE_CANVAS_CLIENT_ID') as string,
    apiOrigin: httpsUrl(env, 'LIVE_CANVAS_API_ORIGIN', true),
    courseId: valueOf(env, 'LIVE_CANVAS_COURSE_ID') as string,
    databaseUrl: valueOf(env, 'LIVE_DATABASE_URL') as string,
    dataEncryptionKeys: valueOf(env, 'LIVE_DATA_ENCRYPTION_KEYS') as string,
    studentSub: valueOf(env, 'LIVE_CANVAS_STUDENT_SUB'),
    labelMode: labelMode as AgsLabelMode,
  };
}

/**
 * Reads the live plan from an environment.
 * @param env - Usually `process.env`.
 * @returns `none` when nothing asks for a run, `mock` for `LIVE_TARGET=mock`, else the real targets named.
 * @throws LiveConfigError for an unknown `LIVE_TARGET`, a mock target mixed with a real one, a Canvas target set only
 *   in part, an unknown label mode, or a URL that is not https.
 * @example
 * const plan = livePlanOf(process.env);
 * describe.runIf(runsCanvas(plan))('…', () => { … });
 * @spec LTI-012
 */
export function livePlanOf(env: Environment): LivePlan {
  const target = valueOf(env, 'LIVE_TARGET');
  if (target !== undefined && target !== 'mock') throw new LiveConfigError('LIVE_TARGET may only be mock');
  const canvas = canvasSettings(env);
  const feideIssuer = valueOf(env, 'LIVE_FEIDE_ISSUER') && httpsUrl(env, 'LIVE_FEIDE_ISSUER', false);
  if (target === 'mock') {
    // SECURITY: a mock run creates and removes test rows; it must never run with the test server's settings at hand.
    if (canvas || feideIssuer)
      throw new LiveConfigError(
        'LIVE_TARGET=mock cannot be combined with LIVE_CANVAS_* or LIVE_FEIDE_ISSUER',
      );
    return { kind: 'mock' };
  }
  if (!canvas && !feideIssuer) return { kind: 'none' };
  return { kind: 'live', canvas, feideIssuer: feideIssuer || undefined };
}

/**
 * Tells whether the Canvas checks run.
 * @param plan - From `livePlanOf`.
 * @returns True for the mock target and for a named Canvas.
 */
export const runsCanvas = (plan: LivePlan): boolean =>
  plan.kind === 'mock' || (plan.kind === 'live' && plan.canvas !== undefined);

/**
 * Tells whether the Feide checks run.
 * @param plan - From `livePlanOf`.
 * @returns True for the mock target and for a named Feide issuer.
 */
export const runsFeide = (plan: LivePlan): boolean =>
  plan.kind === 'mock' || (plan.kind === 'live' && plan.feideIssuer !== undefined);
