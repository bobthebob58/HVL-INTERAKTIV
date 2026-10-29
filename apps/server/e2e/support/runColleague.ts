/**
 * runColleague — a second HVL staff author for the flows that need two people (the content bank): a mock Feide user
 * of this run with the demo author's organisation and affiliations, signed in through the real Feide redirects.
 *
 * Why: a bank copy is one staff author copying another's activity (PROD-007, D-091, D-092). Like the run author
 *      (../../test/support/runFeideAuthor.ts), the colleague's Feide ID and subject belong to this run only, so the
 *      test bed's close removes the account with its copies, whatever earlier runs left.
 * Spec: NFR-004, PROD-007, AUTH-002
 * Invariants:
 *   - The colleague keeps the demo author's realm, affiliations and groups, so the same roles and the same staff
 *     eligibility apply (D-090); only the key, the name, the e-mail, the Feide ID and the subject differ.
 *   - The test bed's cleanup finds the account by the subject hashes of its own mock's users, which include this one.
 * Collaborators: ../../test/support/runFeideAuthor.ts, ../../test/support/appTestbed.ts,
 *   ../../../../tools/mock-platform/mockPlatform.mjs.
 * Tests: apps/server/e2e/bankDuplicate.e2e.test.ts
 */
import { randomBytes } from 'node:crypto';
import type { Browser } from 'playwright-core';
import { FEIDE_DEMO_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import type { AppTestbed } from '../../test/support/appTestbed.js';
import { AUTHOR_KEY, signInRunAuthor, type BrowserStorage } from '../../test/support/runFeideAuthor.js';

/** The mock Feide key of the colleague. */
export const COLLEAGUE_KEY = 'colleague';

/** The colleague's display name, as Feide releases it (test data). */
export const COLLEAGUE_NAME = 'Kari Kollega';

/** A signed-in colleague. */
export interface Colleague {
  /** The browser storage of the signed-in colleague. */
  readonly storage: BrowserStorage;
  /** The colleague's `User.id`. */
  readonly userId: string;
}

/**
 * Adds the colleague to the test bed's mock Feide and signs them in through the start page.
 * @param browser - A running Chromium.
 * @param tb - The test bed.
 * @returns The colleague's storage and account.
 */
export async function signInColleague(browser: Browser, tb: AppTestbed): Promise<Colleague> {
  const demo = FEIDE_DEMO_USERS.find((user) => user.key === AUTHOR_KEY);
  if (!demo) throw new Error('the mock Feide has no demo author');
  const { sub: _demoSubject, ...rest } = demo;
  const feideId = `${COLLEAGUE_KEY}.${randomBytes(6).toString('hex')}@hvl.no`;
  tb.mock.feide.addUser({ ...rest, key: COLLEAGUE_KEY, name: COLLEAGUE_NAME, email: feideId, feideId });
  const storage = await signInRunAuthor(browser, tb, COLLEAGUE_KEY);
  return { storage, userId: await tb.feideAccount(COLLEAGUE_KEY) };
}
