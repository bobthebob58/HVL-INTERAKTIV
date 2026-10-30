/**
 * env — the validated server configuration, read once from environment variables at startup.
 *
 * Why: a missing or malformed setting should stop the server at boot with a message that names the
 *      variable, rather than fail later inside a request. Every variable is documented in .env.example.
 * Spec: DOC-008, MAPPE-003, MAPPE-004, LTI-013, LTI-008
 * Invariants:
 *   - Every variable read anywhere in the server is declared here, one per line as `NAME: z…`
 *     (doc-lint compares this list with .env.example).
 *   - Error messages name variables, never their values (values can be secrets).
 *   - With NODE_ENV=production, the checks in ./productionChecks.ts also apply.
 *   - The portfolio's minimum group size is never below 3 (INS-006, D-095); the PDF export runs 1–8 renders at a
 *     time, and its sandbox is on unless development turns it off (D-096).
 *   - `AGS_LABEL_MODE` is `suffix` unless HVL and ALU answer Q8 otherwise (D-105); the NRPS learner count reads at
 *     most `NRPS_MAX_PAGES` pages of 50 learners (LTI-008).
 * Collaborators: apps/server/.env.example, ./envParsers.ts, ./productionChecks.ts,
 *   ../privacy/pseudonymSecrets.ts, ../h5p/H5pConfigFactory.ts.
 * Tests: apps/server/test/config/env.test.ts, apps/server/test/config/studioEnv.test.ts
 */
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { AGS_LABEL_MODES } from '../lti/deepLinking/formativeLabel.js';
import { parsePseudonymSecrets } from '../privacy/pseudonymSecrets.js';
import {
  FEIDE_GROUP_PATTERN,
  FEIDE_ID_PATTERN,
  FEIDE_REALM_PATTERN,
  ltiPlatformList,
  parsedWith,
  toJson,
  toKeyring,
  toMatchingList,
  toOrigin,
  toOriginList,
} from './envParsers.js';
import { productionProblems } from './productionChecks.js';

/** The schema of every environment variable the server reads. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must start with postgresql://'),
  REDIS_URL: z.string().regex(/^rediss?:\/\//, 'must start with redis:// or rediss://'),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default('eu-north-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  S3_CONTENT_BUCKET: z.string().min(3).default('hvli-content'),
  S3_TEMPORARY_BUCKET: z.string().min(3).default('hvli-temporary'),
  H5P_CORE_DIR: z.string().min(1).default('h5p/core'),
  H5P_EDITOR_DIR: z.string().min(1).default('h5p/editor'),
  H5P_LIBRARY_DIR: z.string().min(1).default('var/h5p/libraries'),
  H5P_SITE_UUID: z.uuid().optional(),
  PSEUDONYM_SECRETS: z.string().transform(parsedWith(parsePseudonymSecrets)),
  PUBLIC_BASE_URL: z
    .url({ protocol: /^https?$/ })
    .transform(toOrigin)
    .default('http://localhost:3000'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  CANVAS_ORIGINS: z.string().transform(toOriginList).default([]),
  EXTERNAL_MEDIA_ORIGINS: z.string().transform(toOriginList).default([]),
  CAPTIONED_MEDIA_ORIGINS: z.string().transform(toOriginList).default([]),
  WEB_APP: z.enum(['off', 'dev', 'prod']).default('off'),
  LTI_PLATFORMS: z.string().transform(toJson).pipe(ltiPlatformList).default([]),
  LTI_TOKEN_MAX_AGE_SECONDS: z.coerce.number().int().min(1).max(60).default(10),
  AGS_LABEL_MODE: z.enum(AGS_LABEL_MODES).default('suffix'),
  NRPS_MAX_PAGES: z.coerce.number().int().min(1).max(1000).default(100),
  FEIDE_ISSUER: z.url({ protocol: /^https?$/ }).default('https://auth.dataporten.no'),
  FEIDE_CLIENT_ID: z.string().min(1),
  FEIDE_CLIENT_SECRET: z.string().min(1),
  FEIDE_GROUPS_API_URL: z.url({ protocol: /^https?$/ }).default('https://groups-api.dataporten.no'),
  ALLOWED_FEIDE_ORGS: z
    .string()
    .transform(toMatchingList(FEIDE_REALM_PATTERN, 'a Feide realm like hvl.no'))
    .default(['hvl.no']),
  ADMIN_FEIDE_IDS: z
    .string()
    .transform(toMatchingList(FEIDE_ID_PATTERN, 'a Feide ID like name@hvl.no'))
    .default([]),
  AUTHOR_COURSE_GROUPS: z
    .string()
    .transform(toMatchingList(FEIDE_GROUP_PATTERN, 'a Feide group ID like fc:…'))
    .default([]),
  IDENTITY_HASH_KEYS: z.string().transform(toKeyring),
  DATA_ENCRYPTION_KEYS: z.string().transform(toKeyring),
  URL_SIGNING_KEYS: z.string().transform(toKeyring),
  MIN_GROUP_SIZE: z.coerce.number().int().min(3, 'must be an integer of at least 3 (INS-006)').default(5),
  PDF_BROWSER_EXECUTABLE: z.string().refine(isAbsolute, 'must be an absolute path').optional(),
  PDF_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  PDF_ALLOW_NO_SANDBOX: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

/** The parsed configuration. */
export type Env = z.infer<typeof envSchema>;

/** Thrown when the environment does not satisfy `envSchema`. */
export class InvalidEnvironmentError extends Error {
  /**
   * @param problems - One line per invalid variable, e.g. `DATABASE_URL: Required`.
   */
  constructor(readonly problems: string[]) {
    super(
      `Invalid server configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
        'See apps/server/.env.example for what each variable means and an example value.',
    );
    this.name = 'InvalidEnvironmentError';
  }
}

const problemsOf = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

// WHY: an empty string (e.g. `S3_ENDPOINT=` in .env) means "not set", so defaults and optionals apply.
const withoutEmpty = (source: NodeJS.ProcessEnv) =>
  Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));

/**
 * Validates and parses the environment.
 * @param source - Variables to read; defaults to `process.env`.
 * @param now - The current time, for the production check of this year's pseudonym secret.
 * @returns The typed configuration.
 * @throws InvalidEnvironmentError listing every invalid or missing variable.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env, now: Date = new Date()): Env {
  const result = envSchema.safeParse(withoutEmpty(source));
  if (!result.success) throw new InvalidEnvironmentError(problemsOf(result.error));
  const problems = result.data.NODE_ENV === 'production' ? productionProblems(result.data, now) : [];
  if (problems.length > 0) throw new InvalidEnvironmentError(problems);
  return result.data;
}

/**
 * Validates only some variables, for tools that need no services (e.g. the H5P boot check).
 * @param keys - Variables to read; all others are ignored, even when missing.
 * @param source - Variables to read from; defaults to `process.env`.
 * @returns The typed subset of the configuration.
 * @throws InvalidEnvironmentError listing every invalid variable among `keys`.
 */
export function loadEnvPart<K extends keyof Env>(
  keys: readonly K[],
  source: NodeJS.ProcessEnv = process.env,
): Pick<Env, K> {
  const shape = Object.fromEntries(keys.map((key) => [key, envSchema.shape[key]]));
  const result = z.object(shape).safeParse(withoutEmpty(source));
  if (!result.success) throw new InvalidEnvironmentError(problemsOf(result.error));
  return result.data as unknown as Pick<Env, K>;
}
