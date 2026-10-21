/**
 * env — the validated server configuration, read once from environment variables at startup.
 *
 * Why: a missing or malformed setting should stop the server at boot with a message that names the
 *      variable, rather than fail later inside a request. Every variable is documented in .env.example.
 * Spec: DOC-008
 * Invariants:
 *   - Every variable read anywhere in the server is declared here, one per line as `NAME: z…`
 *     (doc-lint compares this list with .env.example).
 *   - Error messages name variables, never their values (values can be secrets).
 * Collaborators: apps/server/.env.example, ../privacy/pseudonymSecrets.ts, ../h5p/H5pConfigFactory.ts.
 * Tests: apps/server/test/config/env.test.ts
 */
import { z } from 'zod';
import { parsePseudonymSecrets } from '../privacy/pseudonymSecrets.js';

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
  PSEUDONYM_SECRETS: z.string().transform((raw, ctx) => {
    try {
      return parsePseudonymSecrets(raw);
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: (error as Error).message });
      return z.NEVER;
    }
  }),
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

/**
 * Validates and parses the environment.
 * @param source - Variables to read; defaults to `process.env`.
 * @returns The typed configuration.
 * @throws InvalidEnvironmentError listing every invalid or missing variable.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // WHY: an empty string (e.g. `S3_ENDPOINT=` in .env) means "not set", so defaults and optionals apply.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new InvalidEnvironmentError(problems);
}
