/**
 * storageResidency — the production rule that file storage is in the EEA, and the facts the start-up log names.
 *
 * Why: DATA-004 asks for PostgreSQL, Redis and S3 in Norway or the EEA. Files are the part most likely to sit in a
 *      cloud service, where one wrong region setting moves activities' files abroad, so production refuses a storage
 *      region or endpoint outside an allow-list (D-109's amendment of 2026-11-04). The database and Redis are usually
 *      reached by internal names or addresses, which say nothing, so they are named in the start-up log instead.
 * Spec: DATA-004
 * Invariants:
 *   - Without `S3_ENDPOINT` (AWS itself), `S3_REGION` must be in `EEA_S3_REGIONS`.
 *   - With `S3_ENDPOINT`, its host must be AWS's S3 endpoint of an `EEA_S3_REGIONS` region, or equal or lie under a
 *     domain in `EEA_STORAGE_DOMAINS`.
 *   - The lists are code, never configuration: whoever sets `S3_ENDPOINT` would set the list too, so an entry is added
 *     by a reviewed change and an amendment to D-109. The values are marked (verify) until HVL confirms them (Q5).
 *   - The AWS SDK's own endpoint variables (`SDK_ENDPOINT_VARIABLES`) are refused when set: without `S3_ENDPOINT`
 *     the SDK would send files there, past this check and the TLS check (D-109 amendment of 2026-11-05).
 *   - `S3_CONTENT_BUCKET` and `S3_TEMPORARY_BUCKET` must be plain bucket names: the SDK sends an access point or
 *     Outposts ARN to the ARN's own region, past `S3_REGION` (D-109 amendment of 2026-11-05, the step-5 review).
 *   - The check catches a wrong setting; it proves nothing about where a server stands (the checklist's evidence).
 *   - Messages and `deploymentLocations` name hosts and regions only, never a user, password, path or query; the
 *     database host is the one node-postgres connects to (a `host` query parameter wins over the URL's host).
 * Collaborators: ./productionChecks.ts (calls it in production), ./env.ts, docs/ops/database-roles.md.
 * Tests: apps/server/test/config/storageResidency.test.ts
 */
import type { Env } from './env.js';

/**
 * AWS regions in EEA countries (verify): Stockholm, Ireland, Paris, Frankfurt, Milan, Spain. London (`eu-west-2`)
 * and Zurich (`eu-central-2`) are outside the EEA.
 */
export const EEA_S3_REGIONS: readonly string[] = [
  'eu-north-1',
  'eu-west-1',
  'eu-west-3',
  'eu-central-1',
  'eu-south-1',
  'eu-south-2',
];

/** Domains whose S3-compatible storage HVL may use (verify, Q5): HVL's own servers or Sikt's. */
export const EEA_STORAGE_DOMAINS: readonly string[] = ['hvl.no', 'sikt.no'];

/**
 * The AWS SDK's own endpoint variables, which it reads when the client has no endpoint (SDK 3.1155.0: the S3 one
 * first, then the general one). `S3_ENDPOINT` is the one setting for another store.
 */
export const SDK_ENDPOINT_VARIABLES: readonly string[] = ['AWS_ENDPOINT_URL_S3', 'AWS_ENDPOINT_URL'];

/** The bucket variables; each must name one bucket, never an ARN. */
export const S3_BUCKET_VARIABLES = ['S3_CONTENT_BUCKET', 'S3_TEMPORARY_BUCKET'] as const;

// WHY: S3's naming rules: 3–63 lower-case letters, digits, dots and hyphens, starting and ending with a letter or digit.
const PLAIN_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/** The variables the storage rule and the start-up facts read. */
export type ResidencyCheckedEnv = Pick<Env, 'S3_ENDPOINT' | 'S3_REGION' | 'DATABASE_URL' | 'REDIS_URL'>;

/** Where the server's data lives, for the start-up log and the deployment checklist. */
export interface DeploymentLocations {
  readonly databaseHost: string;
  readonly redisHost: string;
  readonly s3Region: string;
  /** The S3 endpoint's host, or `AWS` when none is set. */
  readonly s3EndpointHost: string;
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return 'unreadable';
  }
};

// WHY: AWS's own S3 endpoints name their region (`s3.eu-north-1.amazonaws.com`, also dual-stack).
const AWS_S3_HOST = /^s3(?:\.dualstack)?[.-]([a-z0-9-]+)\.amazonaws\.com$/;

/**
 * Tells whether an S3 endpoint host is on the EEA allow-list.
 * @param host - The endpoint's host name, lower case.
 * @returns True for an AWS S3 endpoint of an EEA region, or a host under an approved domain.
 */
export function isEeaStorageHost(host: string): boolean {
  const aws = AWS_S3_HOST.exec(host);
  if (aws) return EEA_S3_REGIONS.includes(aws[1] ?? '');
  return EEA_STORAGE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Lists storage settings outside the EEA allow-list.
 * @param env - Parsed configuration.
 * @returns One `VARIABLE: reason` message per problem; it names the region or host, which are not secret.
 */
export function storageResidencyProblems(env: Pick<Env, 'S3_ENDPOINT' | 'S3_REGION'>): string[] {
  if (env.S3_ENDPOINT === undefined) {
    return EEA_S3_REGIONS.includes(env.S3_REGION)
      ? []
      : [
          `S3_REGION: ${env.S3_REGION} is not an AWS region on the EEA list (${EEA_S3_REGIONS.join(', ')}); ` +
            'files must stay in Norway or the EEA (DATA-004)',
        ];
  }
  const host = hostOf(env.S3_ENDPOINT);
  return isEeaStorageHost(host)
    ? []
    : [
        `S3_ENDPOINT: the host ${host} is not on the EEA storage list (an AWS EEA region, or under ` +
          `${EEA_STORAGE_DOMAINS.join(' or ')}); adding one needs an amendment to D-109 (DATA-004)`,
      ];
}

/**
 * Lists the bucket variables that are not plain bucket names.
 * @param env - Parsed configuration.
 * @returns One `VARIABLE: reason` message per variable, naming no value (an ARN holds an account ID).
 */
export function bucketNameProblems(env: Pick<Env, (typeof S3_BUCKET_VARIABLES)[number]>): string[] {
  // SECURITY: the SDK routes an access point or Outposts ARN to its own region, past the EEA check (D-109, review).
  return S3_BUCKET_VARIABLES.filter((name) => !PLAIN_BUCKET.test(env[name])).map(
    (name) =>
      `${name}: production needs a plain S3 bucket name (lower-case letters, digits, dots and hyphens); an ARN ` +
      'would send files to its own region, past the EEA list (DATA-004)',
  );
}

/**
 * Lists the AWS SDK's own endpoint variables that are set.
 * @param source - The raw environment (these variables are not part of the parsed configuration).
 * @returns One `VARIABLE: reason` message per variable set, naming no value.
 */
export function sdkEndpointProblems(source: NodeJS.ProcessEnv): string[] {
  // SECURITY: the SDK would send every file to this URL, unchecked for TLS and the EEA list (D-109, 2026-11-05).
  return SDK_ENDPOINT_VARIABLES.filter((name) => (source[name] ?? '') !== '').map(
    (name) =>
      `${name}: the AWS SDK would send files there unchecked for TLS and the EEA list; remove it and set ` +
      'S3_ENDPOINT instead (DATA-004)',
  );
}

// WHY: pg-connection-string connects to a `host` query parameter (the last one) rather than the URL's host.
const databaseHostOf = (url: string): string => {
  try {
    return new URL(url).searchParams.getAll('host').at(-1)?.toLowerCase() || hostOf(url);
  } catch {
    return 'unreadable';
  }
};

/**
 * Names where the data lives, for one start-up log line that the deployment checklist is ticked against.
 * @param env - Parsed configuration.
 * @returns Hosts and the region only; never a user, password, path or query.
 */
export function deploymentLocations(env: ResidencyCheckedEnv): DeploymentLocations {
  return {
    databaseHost: databaseHostOf(env.DATABASE_URL),
    redisHost: hostOf(env.REDIS_URL),
    s3Region: env.S3_REGION,
    s3EndpointHost: env.S3_ENDPOINT === undefined ? 'AWS' : hostOf(env.S3_ENDPOINT),
  };
}
