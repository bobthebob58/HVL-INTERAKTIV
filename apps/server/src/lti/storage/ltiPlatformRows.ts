/**
 * ltiPlatformRows — converts between ltijs platform records and `LtiPlatform` rows, encrypting the tool's
 * private key on the way in and decrypting it on the way out.
 *
 * Why: ltijs works with `PlatformRecord` objects (`idTokenValidation`, `keys.public`, `keys.private`); the table
 *      stores flat columns and must hold the private key encrypted at rest (LTI-002, D-056). Keeping the mapping
 *      in one place means no other module ever sees `privateKeyEncrypted`.
 * Spec: LTI-002
 * Invariants:
 *   - `keys.private` is written only as `privateKeyEncrypted`, encrypted with the current key of
 *     `DATA_ENCRYPTION_KEYS` for the purpose `lti-private-key`; every write of keys re-encrypts (D-056).
 *   - A row whose private key cannot be decrypted, or whose validation method ltijs does not know, throws: a
 *     platform without a usable key must never sign anything.
 *   - An update writes only the fields it is given, so a concurrent update of another field is not reverted.
 * Collaborators: ./PrismaLtiDatabaseManager.ts, ../../security/keys/DataEncryption.ts, ../platforms/LtiDeploymentGuard.ts.
 * Tests: apps/server/test/lti/storage/ltiStorageRows.test.ts, apps/server/test/lti/storage/ltiSecretsAtRest.int.test.ts
 */
import { IdTokenValidationMethod } from 'ltijs';
import type {
  IdTokenValidation,
  PlatformAttributes,
  PlatformFilter,
  PlatformKeys,
  PlatformRecord,
} from 'ltijs';
import type { LtiPlatform, Prisma } from '../../generated/prisma/client.js';
import type { DataEncryption } from '../../security/keys/DataEncryption.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHODS: ReadonlySet<string> = new Set(Object.values(IdTokenValidationMethod));

/** Columns that hold a platform's settings unchanged. */
type SettingColumns = Pick<
  Prisma.LtiPlatformUpdateManyMutationInput,
  'url' | 'clientId' | 'name' | 'authenticationEndpoint' | 'accessTokenEndpoint' | 'active'
>;
const SETTING_FIELDS = [
  'url',
  'clientId',
  'name',
  'authenticationEndpoint',
  'accessTokenEndpoint',
  'active',
] as const satisfies readonly (keyof SettingColumns & keyof PlatformAttributes)[];

/**
 * Tells whether a value can be a platform ID (the `LtiPlatform.id` UUID column).
 * @param value - An ID from ltijs, e.g. from an ID-token record or a JWT `kid`.
 * @returns True only for a canonical UUID; anything else cannot name a platform.
 */
export const isPlatformId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

const keyColumns = (keys: PlatformKeys, encryption: DataEncryption) => ({
  publicKey: keys.public,
  // SECURITY: the tool's private key signs ltiks and Deep Linking responses; a database dump alone must not reveal it (LTI-002, D-056).
  // WHY: Prisma's Bytes type is a Uint8Array over a plain ArrayBuffer; the copy gives it exactly that.
  privateKeyEncrypted: new Uint8Array(encryption.encrypt('lti-private-key', keys.private)),
});

const validationColumns = (validation: Partial<IdTokenValidation>) => ({
  ...(validation.method !== undefined && { idTokenValidationMethod: validation.method }),
  ...(validation.key !== undefined && { idTokenValidationKey: validation.key }),
});

/**
 * Builds a platform record from its row.
 * @param row - The stored row.
 * @param encryption - `DATA_ENCRYPTION_KEYS`.
 * @returns The record ltijs expects, with the decrypted private key.
 * @throws DecryptionError when the private key cannot be decrypted; Error for an unknown validation method.
 */
export function platformFromRow(row: LtiPlatform, encryption: DataEncryption): PlatformRecord {
  if (!METHODS.has(row.idTokenValidationMethod)) {
    throw new Error(`LTI platform ${row.id} has an unknown ID-token validation method`);
  }
  const privateKey = encryption.decrypt('lti-private-key', Buffer.from(row.privateKeyEncrypted));
  return {
    id: row.id,
    url: row.url,
    clientId: row.clientId,
    name: row.name,
    authenticationEndpoint: row.authenticationEndpoint,
    accessTokenEndpoint: row.accessTokenEndpoint,
    ...(row.authorizationServer !== null && { authorizationServer: row.authorizationServer }),
    idTokenValidation: {
      method: row.idTokenValidationMethod as IdTokenValidationMethod,
      key: row.idTokenValidationKey,
    },
    active: row.active,
    keys: { public: row.publicKey, private: privateKey.toString('utf8') },
  };
}

/**
 * Builds the columns of a new platform row.
 * @param platform - What ltijs saves (keys included).
 * @param encryption - `DATA_ENCRYPTION_KEYS`.
 * @returns The create input.
 */
export function platformCreateData(
  platform: PlatformAttributes,
  encryption: DataEncryption,
): Prisma.LtiPlatformCreateInput {
  return {
    url: platform.url,
    clientId: platform.clientId,
    name: platform.name,
    authenticationEndpoint: platform.authenticationEndpoint,
    accessTokenEndpoint: platform.accessTokenEndpoint,
    authorizationServer: platform.authorizationServer ?? null,
    idTokenValidationMethod: platform.idTokenValidation.method,
    idTokenValidationKey: platform.idTokenValidation.key,
    active: platform.active,
    ...keyColumns(platform.keys, encryption),
  };
}

/**
 * Builds the columns of a partial update; fields that are absent or undefined are left unchanged.
 * @param fields - The fields ltijs changes.
 * @param encryption - `DATA_ENCRYPTION_KEYS`, used when `keys` is among them.
 * @returns The update input.
 */
export function platformUpdateData(
  fields: Partial<PlatformAttributes>,
  encryption: DataEncryption,
): Prisma.LtiPlatformUpdateManyMutationInput {
  const data: Prisma.LtiPlatformUpdateManyMutationInput = {};
  for (const field of SETTING_FIELDS) {
    if (fields[field] !== undefined) Object.assign(data, { [field]: fields[field] });
  }
  if (fields.authorizationServer !== undefined) data.authorizationServer = fields.authorizationServer;
  if (fields.idTokenValidation !== undefined)
    Object.assign(data, validationColumns(fields.idTokenValidation));
  if (fields.keys !== undefined) Object.assign(data, keyColumns(fields.keys, encryption));
  return data;
}

/**
 * Builds the row filter of `getPlatforms`.
 * @param filter - ltijs's filter: URL, name, and one client ID or a list of them.
 * @returns The where input; an empty filter matches every platform.
 */
export function platformWhere(filter: PlatformFilter = {}): Prisma.LtiPlatformWhereInput {
  const where: Prisma.LtiPlatformWhereInput = {};
  if (filter.url !== undefined) where.url = filter.url;
  if (filter.name !== undefined) where.name = filter.name;
  if (filter.clientId !== undefined) {
    where.clientId = Array.isArray(filter.clientId) ? { in: [...filter.clientId] } : filter.clientId;
  }
  return where;
}
