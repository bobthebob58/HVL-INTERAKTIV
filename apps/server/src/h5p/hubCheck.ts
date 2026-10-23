/**
 * hubCheck — asks the H5P Hub, once and on purpose, whether this installation can register and whether it
 * offers the ten content types in at least the required versions (spike step 3, spec 01 §7).
 *
 * Why: the server never calls the Hub while serving requests (D-041), so the F1/F2 findings and the Hub's
 *      versions are checked by an operator command instead. The report records the exact status codes, which
 *      is the evidence the spike and R-01 need (D-047).
 * Spec: H5P-001, H5P-003
 * Invariants:
 *   - Contacts only the config's Hub endpoints (hub-api.h5p.org); never api.h5p.org.
 *   - Changes nothing: no config, cache or library is written; a returned UUID is only reported.
 *   - The `local_id` sent is the F1 value (`localIdFor`), at most 15 characters.
 * Collaborators: ./hubCheckCli.ts, ./H5pConfigFactory.ts, ./HvlTop10ContentTypeFilter.ts.
 * Tests: apps/server/test/h5p/hubCheck.test.ts
 */
import type { IH5PConfig } from '@lumieducation/h5p-server';
import { LOCAL_ID_MAX_LENGTH, localIdFor } from './H5pConfigFactory.js';

/** Minimum versions of the ten types (spec 01 §3); a test compares them with the spec table. */
export const HUB_MIN_VERSIONS: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['H5P.CoursePresentation', [1, 27]],
  ['H5P.InteractiveVideo', [1, 28]],
  ['H5P.QuestionSet', [1, 21]],
  ['H5P.InteractiveBook', [1, 12]],
  ['H5P.Column', [1, 19]],
  ['H5P.DragText', [1, 10]],
  ['H5P.MultiChoice', [1, 16]],
  ['H5P.Blanks', [1, 14]],
  ['H5P.ImageHotspots', [1, 10]],
  ['H5P.BranchingScenario', [1, 9]],
]);

/** One HTTP exchange with the Hub, as reported. */
export interface HubCall {
  readonly status?: number;
  readonly error?: string;
}

/** What `runHubCheck` found. */
export interface HubCheckReport {
  /** F1: length of the `local_id` this installation sends. */
  readonly localIdLength: number;
  /** F2: the registration call, made only when no site UUID is configured. */
  readonly registration: HubCall & { readonly attempted: boolean; readonly uuid?: string };
  /** The content-type list, fetched with the configured or returned UUID. */
  readonly contentTypes: HubCall & { readonly count?: number; missing: string[]; tooOld: string[] };
  /** True when F1 holds, the list answered 200, and all ten types are there in the required versions. */
  readonly ok: boolean;
}

type Fetch = typeof fetch;

interface HubContentType {
  id?: string;
  version?: { major?: number; minor?: number };
}

const call = async (fetchImpl: Fetch, url: string, init: RequestInit): Promise<[HubCall, unknown]> => {
  try {
    const response = await fetchImpl(url, init);
    const body: unknown = await response.json().catch(() => undefined);
    return [{ status: response.status }, body];
  } catch (error) {
    // WHY: Node's fetch reports "fetch failed" and keeps the reason (DNS, TLS, proxy refusal) in `cause`.
    const { message, cause } = error as Error & { cause?: { message?: string } };
    return [{ error: cause?.message ? `${message}: ${cause.message}` : message }, undefined];
  }
};

function compareTypes(list: HubContentType[]): { missing: string[]; tooOld: string[] } {
  const missing: string[] = [];
  const tooOld: string[] = [];
  for (const [name, [major, minor]] of HUB_MIN_VERSIONS) {
    const entry = list.find((type) => type.id === name);
    if (!entry?.version) missing.push(name);
    else if ((entry.version.major ?? 0) * 1000 + (entry.version.minor ?? 0) < major * 1000 + minor)
      tooOld.push(name);
  }
  return { missing, tooOld };
}

/**
 * Runs the check.
 * @param config - The server's H5P config (Hub endpoints, site UUID, versions).
 * @param fetchImpl - HTTP client; Node's fetch by default.
 * @returns The report; never throws for network or Hub errors.
 */
export async function runHubCheck(config: IH5PConfig, fetchImpl: Fetch = fetch): Promise<HubCheckReport> {
  const data = {
    core_api_version: `${config.coreApiVersion.major}.${config.coreApiVersion.minor}`,
    disabled: config.fetchingDisabled,
    h5p_version: config.h5pVersion,
    local_id: localIdFor(config.uuid),
    platform_name: config.platformName,
    platform_version: config.platformVersion,
    type: config.siteType,
    uuid: config.uuid,
  };
  let uuid = config.uuid;
  let registration: HubCheckReport['registration'] = { attempted: false };
  if (!uuid) {
    const [result, body] = await call(fetchImpl, config.hubRegistrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    uuid = typeof (body as { uuid?: unknown })?.uuid === 'string' ? (body as { uuid: string }).uuid : '';
    registration = { attempted: true, ...result, ...(uuid ? { uuid } : {}) };
  }
  let contentTypes: HubCheckReport['contentTypes'] = { missing: [...HUB_MIN_VERSIONS.keys()], tooOld: [] };
  if (uuid) {
    const form = new URLSearchParams(Object.entries({ ...data, uuid }).map(([k, v]) => [k, String(v)]));
    const [result, body] = await call(fetchImpl, config.hubContentTypesEndpoint, {
      method: 'POST',
      body: form,
    });
    const list = (body as { contentTypes?: HubContentType[] } | undefined)?.contentTypes ?? [];
    contentTypes = { ...result, count: list.length, ...compareTypes(list) };
  }
  const ok =
    data.local_id.length <= LOCAL_ID_MAX_LENGTH &&
    contentTypes.status === 200 &&
    contentTypes.missing.length === 0 &&
    contentTypes.tooOld.length === 0;
  return { localIdLength: data.local_id.length, registration, contentTypes, ok };
}
