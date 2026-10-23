/**
 * ltiIdTokenClaims — the allowlist of LTI ID-token claims that may be stored, and the function that applies it.
 *
 * Why: ltijs stores the whole validated ID token so that a later request with the ltik can rebuild the launch
 *      (`getLaunchContext`). That token can carry names, e-mail, `lis` identifiers and custom fields we must not
 *      keep (DATA-002, D-052). Storage keeps exactly what a later request reads, and nothing else.
 * Spec: LTI-002, DATA-002
 * Invariants:
 *   - Never mutates its argument (ltijs hands the handler the same objects after storage, and later freezes
 *     them), and shares no object with it: the result is a deep copy.
 *   - Kept, because ltijs or our code reads them after the launch: `iss`, `sub` (AGS score user), `aud`, `azp`,
 *     `iat`, `exp`, ltijs's own `client_id` and `platform_id`, deployment ID, message type, version, roles,
 *     target link URI, Canvas's placement claim, and the listed fields of context, resource link, launch
 *     presentation, tool platform, AGS endpoint, NRPS and Deep Linking settings (rebuilt by ltijs's
 *     `buildIdToken`; Deep Linking responses read deployment, version and settings; AGS reads `sub` and the
 *     endpoint), plus the custom keys `contentId` and `hvl_placement`, and the top-level `locale` (UI language).
 *   - Dropped: every other top-level claim (names, `email`, `picture`, `lis`, `role_scope_mentor`,
 *     `for_user`, `nonce`, LTI 1.1 legacy IDs, unknown claims), `tool_platform.contact_email`, every other
 *     custom key (`feide_login` included) and every nested field not listed.
 * Collaborators: ./PrismaLtiDatabaseManager.ts (saveIdToken), ltijs `LaunchService.processLaunch`.
 * Tests: apps/server/test/lti/storage/ltiIdTokenClaims.test.ts,
 *   apps/server/test/lti/storage/PrismaLtiDatabaseManager.int.test.ts,
 *   apps/server/test/lti/storage/ltijsOnPrismaStorage.int.test.ts
 */
import type { IdTokenClaims } from 'ltijs';

const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';

/** Canvas's claim naming the placement of a launch, e.g. `assignment_selection` (D-061). */
export const CANVAS_PLACEMENT_CLAIM = 'https://www.instructure.com/placement';

/** The LTI custom-parameter claim. */
export const LTI_CUSTOM_CLAIM = `${LTI}custom`;

/** Top-level claims stored as they are (strings, numbers or string lists). */
const KEPT_VALUE_CLAIMS: readonly string[] = [
  'iss',
  'sub',
  'aud',
  'azp',
  'iat',
  'exp',
  'client_id',
  'platform_id',
  `${LTI}deployment_id`,
  `${LTI}message_type`,
  `${LTI}version`,
  `${LTI}roles`,
  `${LTI}target_link_uri`,
  CANVAS_PLACEMENT_CLAIM,
  // WHY: the UI language when the launch has no launch_presentation.locale (../ltiLocale.ts); not personal data.
  'locale',
];

/** Object claims stored with only the listed fields. */
const KEPT_OBJECT_CLAIMS: Readonly<Record<string, readonly string[]>> = {
  [`${LTI}context`]: ['id', 'label', 'title', 'type'],
  [`${LTI}resource_link`]: ['id', 'title', 'description'],
  [`${LTI}launch_presentation`]: ['document_target', 'width', 'height', 'return_url', 'locale'],
  // PRIVACY: contact_email names a person at the platform's institution; it is not needed later (DATA-002).
  [`${LTI}tool_platform`]: ['guid', 'name', 'description', 'version', 'product_family_code'],
  'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': ['scope', 'lineitem', 'lineitems'],
  'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': [
    'context_memberships_url',
    'service_versions',
  ],
  'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings': [
    'deep_link_return_url',
    'accept_types',
    'accept_media_types',
    'accept_presentation_document_targets',
    'accept_multiple',
    'accept_lineitem',
    'auto_create',
    'title',
    'text',
    'data',
  ],
};

/** Custom keys we read after the launch: the activity to open and the placement fallback (D-061). */
export const KEPT_CUSTOM_KEYS: readonly string[] = ['contentId', 'hvl_placement'];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Copies the listed fields of an object claim; a claim that is not an object is dropped. */
function pickFields(value: unknown, fields: readonly string[]): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (value[field] !== undefined) picked[field] = structuredClone(value[field]);
  }
  return picked;
}

/** Copies the kept custom keys; only string values, the form Canvas sends custom parameters in. */
function pickCustom(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const picked: Record<string, string> = {};
  for (const key of KEPT_CUSTOM_KEYS) {
    const entry = value[key];
    if (typeof entry === 'string') picked[key] = entry;
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
}

/**
 * Returns a deep copy of an ID token's claims that holds only the allowlisted claims and fields.
 * @param claims - The validated claims ltijs passes to `saveIdToken`; may be frozen, and is never changed.
 * @returns The claims to store.
 * @spec LTI-002
 */
export function minimiseIdTokenClaims(claims: IdTokenClaims): IdTokenClaims {
  const source: Readonly<Record<string, unknown>> = claims;
  const kept: Record<string, unknown> = {};
  // PRIVACY: an allowlist, so a name, e-mail, `lis` ID or a claim a platform adds later is never stored (DATA-002).
  for (const claim of KEPT_VALUE_CLAIMS) {
    if (source[claim] !== undefined) kept[claim] = structuredClone(source[claim]);
  }
  for (const [claim, fields] of Object.entries(KEPT_OBJECT_CLAIMS)) {
    const picked = pickFields(source[claim], fields);
    if (picked !== undefined) kept[claim] = picked;
  }
  // PRIVACY: custom fields may carry a Feide login or other personal values (`feide_login`, D-063); keep only ours (DATA-002).
  const custom = pickCustom(source[LTI_CUSTOM_CLAIM]);
  if (custom !== undefined) kept[LTI_CUSTOM_CLAIM] = custom;
  return kept as IdTokenClaims;
}
