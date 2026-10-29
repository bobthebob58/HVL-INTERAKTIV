/**
 * runFeideAuthor — gives a test bed's mock Feide an author who exists only in this run, and finds the account a
 * mock Feide user signed in to.
 *
 * Why: the mock Feide's demo users have the same Feide IDs in every process, so their accounts outlive the run that
 *      created them (an interrupted run, or a developer's own sign-in). ./appTestbed.ts removes only the Feide users
 *      whose identity was created during its run, so whatever a later run gave a surviving `author@hvl.no` account
 *      stayed: 3 000+ activities on its start page, and its notice dismissals, which hid the formative-use notice
 *      from every later accessibility run. An author whose Feide ID and subject belong to one run is always new, so
 *      the test bed's close removes it with its content, its dismissals and its acknowledgements.
 * Spec: NFR-004, AUTH-002, DATA-002
 * Invariants:
 *   - The run author replaces the mock's `author` (so `nextLogin('author')` and the default login sign it in) and
 *     keeps the demo author's name, organisation, affiliations and groups, so the same roles apply (AUTH-002); only
 *     the Feide ID (`author.<random>@hvl.no`) and `sub` differ.
 *   - Accounts are found by the keyed subject hash (D-055), never by name or e-mail; a test bed's cleanup takes only
 *     the Feide accounts whose subject is one of its own mock's users (`feideSubjectHashes`), so a test bed closing
 *     in another process never removes this run's author.
 * Collaborators: ./appTestbed.ts, ./realWebApp.ts, ../../../../tools/mock-platform/mockPlatform.mjs,
 *   ../../src/auth/identity/subjectSources.ts.
 * Tests: apps/server/e2e/testbedCleanup.e2e.test.ts
 */
import { randomBytes } from 'node:crypto';
import type { Browser, BrowserContext } from 'playwright-core';
import { FEIDE_DEMO_USERS, type MockFeide } from '../../../../tools/mock-platform/mockPlatform.mjs';
import type { Env } from '../../src/config/env.js';
import { identitySource } from '../../src/auth/identity/subjectSources.js';
import type { Database } from '../../src/infra/prismaClient.js';
import { IdentityHasher } from '../../src/security/keys/IdentityHasher.js';

/** The mock Feide key of the author every test signs in as. */
export const AUTHOR_KEY = 'author';

/** A browser context's cookies and storage, as Playwright saves them. */
export type BrowserStorage = Awaited<ReturnType<BrowserContext['storageState']>>;

/**
 * Replaces the mock Feide's `author` with one whose Feide ID and subject are new.
 * @param feide - The test bed's own mock Feide.
 * @returns The run author's Feide ID.
 */
export function giveRunAuthor(feide: MockFeide): string {
  const demo = FEIDE_DEMO_USERS.find((user) => user.key === AUTHOR_KEY);
  if (!demo) throw new Error('the mock Feide has no demo author');
  const feideId = `${AUTHOR_KEY}.${randomBytes(6).toString('hex')}@hvl.no`;
  const { sub: _demoSubject, ...rest } = demo;
  feide.addUser({ ...rest, feideId });
  return feideId;
}

/**
 * The subject hashes (under every key of the ring) of every user a mock Feide can sign in, so a test bed removes
 * only Feide accounts its own mock created, never another process's run author.
 * @param env - The test bed's environment (its identity hash keys).
 * @param feide - The test bed's mock Feide.
 * @returns The `Identity.subjectHash` values its users' accounts can have.
 */
export function feideSubjectHashes(env: Pick<Env, 'IDENTITY_HASH_KEYS'>, feide: MockFeide): string[] {
  const hasher = new IdentityHasher(env.IDENTITY_HASH_KEYS);
  return [...feide.users.values()].flatMap((user) =>
    user.feideId
      ? hasher
          .candidates('identity-subject', identitySource({ kind: 'feide', feideId: user.feideId }))
          .map((c) => c.hash)
      : [],
  );
}

/**
 * The account a mock Feide user signed in to, as the login created or found it.
 * @param db - The database.
 * @param env - The test bed's environment (its identity hash keys).
 * @param feide - The test bed's mock Feide.
 * @param key - The mock Feide user, e.g. `author`.
 * @returns The `User.id`.
 * @throws Error when that user has no Feide ID or has not signed in.
 */
export async function accountOfFeideUser(
  db: Database,
  env: Pick<Env, 'IDENTITY_HASH_KEYS'>,
  feide: MockFeide,
  key: string,
): Promise<string> {
  const feideId = feide.users.get(key)?.feideId;
  const hashes = feideId
    ? new IdentityHasher(env.IDENTITY_HASH_KEYS).candidates(
        'identity-subject',
        identitySource({ kind: 'feide', feideId }),
      )
    : [];
  const row = await db.identity.findFirst({ where: { subjectHash: { in: hashes.map((c) => c.hash) } } });
  if (!row) throw new Error(`the mock Feide user ${key} has no account`);
  return row.userId;
}

/**
 * Signs the mock Feide author in through the start page, as a person does, and returns the context's storage.
 * @param browser - A running Chromium.
 * @param tb - The test bed whose app and mock Feide are used.
 * @param key - The mock Feide user to sign in; the run author by default (a flow's second author passes its own).
 * @returns The signed-in storage; pass it to `browser.newContext({ storageState })`.
 */
export async function signInRunAuthor(
  browser: Browser,
  tb: { readonly toolUrl: string; readonly mock: { readonly feide: MockFeide } },
  key: string = AUTHOR_KEY,
): Promise<BrowserStorage> {
  const context = await browser.newContext();
  const page = await context.newPage();
  tb.mock.feide.nextLogin(key);
  await page.goto(`${tb.toolUrl}/`);
  await page.getByRole('link', { name: 'Logg inn med Feide' }).click();
  await page.getByRole('button', { name: 'Logg ut' }).waitFor({ timeout: 30_000 });
  const storage = await context.storageState();
  await context.close();
  return storage;
}
