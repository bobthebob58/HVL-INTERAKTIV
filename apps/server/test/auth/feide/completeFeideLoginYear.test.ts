/**
 * Unit tests for the academic year a Feide login gives its session: the year of the secret that made the learnerKey,
 * from the same moment, on both sides of 1 August (D-107). Feide, the Groups API and the account store are stubs.
 *
 * Spec: DATA-012, DATA-002
 */
import { describe, expect, it } from 'vitest';
import type { AccountResolver } from '../../../src/auth/identity/AccountResolver.js';
import { completeFeideLogin, type FeideLoginDeps } from '../../../src/auth/feide/completeFeideLogin.js';
import { FEIDE_ID_CLAIM } from '../../../src/auth/feide/feideClaims.js';
import { deriveLearnerKey } from '../../../src/privacy/deriveLearnerKey.js';
import { parsePseudonymSecrets } from '../../../src/privacy/pseudonymSecrets.js';

const SECRETS = parsePseudonymSecrets(
  `2025=${Buffer.alloc(32, 7).toString('base64')},2026=${Buffer.alloc(32, 9).toString('base64')}`,
);
const FEIDE_ID = 'student@hvl.no';

/** The login's dependencies on a fixed clock: a student of HVL with no groups. */
const depsAt = (now: Date): FeideLoginDeps => ({
  feide: {
    completeLogin: async () => ({
      claims: { [FEIDE_ID_CLAIM]: FEIDE_ID },
      idToken: 'h.p.s',
      accessToken: 'a',
    }),
  },
  groupsApiUrl: 'https://groups.invalid',
  policy: { allowedOrgs: ['hvl.no'], adminFeideIds: [], authorCourseGroups: [] },
  accounts: { resolve: async () => ({ userId: 'user-1' }) } as unknown as AccountResolver,
  secrets: SECRETS,
  audit: { record: async () => undefined },
  now: () => now,
  fetchImpl: (async () => new Response('[]', { status: 200 })) as typeof fetch,
});

const login = (now: Date) =>
  completeFeideLogin(depsAt(now), new URL('https://tool.invalid/auth/feide/callback'), {
    state: 's',
    nonce: 'n',
    codeVerifier: 'v',
  });

describe('[DATA-012] the academic year of a Feide login', () => {
  it.each([
    ['31 July, one second before midnight in Oslo', '2026-07-31T21:59:59Z', 2025],
    ['1 August, at midnight in Oslo', '2026-07-31T22:00:00Z', 2026],
  ])(
    '[DATA-012] a login on %s gives the session the year of the secret that made its key',
    async (_when, at, year) => {
      // Arrange
      const now = new Date(at);
      // Act
      const session = await login(now);
      // Assert
      expect(session.learnerKeyYear).toBe(year);
      expect(session.learnerKey).toBe(deriveLearnerKey({ kind: 'feide', feideId: FEIDE_ID }, SECRETS, now));
    },
  );
});
