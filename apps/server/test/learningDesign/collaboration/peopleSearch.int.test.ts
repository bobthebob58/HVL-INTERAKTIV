/**
 * Integration tests of `GET /api/people` (D-090 as amended) on the `/api` router with injected principals: who can be
 * found by name and by exact Feide ID, who may search, the answer's shape, the limit of 10 and escaped wildcards.
 *
 * Spec: PROD-007, DATA-002
 */
import { peopleSearchResponseSchema } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { LTI_OVERRIDES, NEVER_FINDABLE, personNamed, runToken } from './collaborationFixtures.js';

const TOKEN = runToken();
const feideIdOf = (name: string) => `${name}.${TOKEN}@hvl.no`;

describeWithServices('[PROD-007] people search', () => {
  const tb = openApiTestbed();
  const hasher = new IdentityHasher(serviceEnv().IDENTITY_HASH_KEYS);
  let asker: TestPrincipal;
  let kari: TestPrincipal;
  const refused = new Map<string, TestPrincipal>();

  /** Gives an account a Feide identity, as its Feide login would have. */
  const withFeideId = async (person: TestPrincipal, feideId: string) => {
    const { hash, keyId } = hasher.hash('identity-subject', identitySource({ kind: 'feide', feideId }));
    await tb.db.identity.create({
      data: { userId: person.principal.userId, provider: 'feide', subjectHash: hash, subjectKeyId: keyId },
    });
  };
  const search = (who: TestPrincipal, q: string) =>
    requestAs(tb.app, who, 'get', `/api/people?q=${encodeURIComponent(q)}`);

  beforeAll(async () => {
    asker = await personNamed(tb, `Asker ${TOKEN} Kollega`);
    kari = await personNamed(tb, `Kari ${TOKEN} Nordmann`);
    await withFeideId(kari, feideIdOf('kari'));
    for (const [index, row] of NEVER_FINDABLE.entries()) {
      const person = await personNamed(tb, `Kari ${TOKEN} Ikkje${index}`, {
        role: row.role,
        searchableAt: row.searchableAt,
        ...(row.overrides ? { overrides: row.overrides } : {}),
      });
      await withFeideId(person, feideIdOf(`refused${index}`));
      refused.set(row.kind, person);
    }
  });
  afterAll(() => tb.close());

  it('[PROD-007] finds findable staff by part of the name, case-insensitively, as { userId, displayName } only', async () => {
    // Act
    const res = await search(asker, `kari ${TOKEN.toUpperCase()}`);
    // Assert: only Kari; no e-mail, Feide ID or other field
    expect(res.status).toBe(200);
    expect(peopleSearchResponseSchema.parse(res.body)).toEqual({
      people: [{ userId: kari.principal.userId, displayName: `Kari ${TOKEN} Nordmann` }],
    });
    expect(Object.keys(res.body.people[0] as object).sort()).toEqual(['displayName', 'userId']);
  });

  it.each(NEVER_FINDABLE.map((row) => row.kind))(
    '[PROD-007] never finds %s, by name or by Feide ID',
    async (kind) => {
      // Arrange
      const index = NEVER_FINDABLE.findIndex((row) => row.kind === kind);
      // Act
      const byName = await search(asker, `${TOKEN} Ikkje${index}`);
      const byFeideId = await search(asker, feideIdOf(`refused${index}`));
      // Assert
      expect([byName.status, byName.body]).toEqual([200, { people: [] }]);
      expect([byFeideId.status, byFeideId.body]).toEqual([200, { people: [] }]);
    },
  );

  it('[PROD-007] a Feide ID is looked up exactly through the login hash, in any letter case, never by name', async () => {
    // Act
    const exact = await search(asker, ` ${feideIdOf('KARI')} `);
    const partial = await search(asker, `kari.${TOKEN}@hvl`);
    const other = await search(asker, feideIdOf('nobody'));
    // Assert
    expect(exact.body).toEqual({
      people: [{ userId: kari.principal.userId, displayName: `Kari ${TOKEN} Nordmann` }],
    });
    expect(partial.body).toEqual({ people: [] });
    expect(other.body).toEqual({ people: [] });
  });

  it('[PROD-007] never answers the asker, and answers at most 10, ordered by name', async () => {
    // Arrange: twelve more findable colleagues
    for (let n = 10; n < 22; n += 1) await personNamed(tb, `Many ${TOKEN} ${n}`);
    // Act
    const many = await search(asker, `Many ${TOKEN}`);
    const self = await search(asker, `Asker ${TOKEN}`);
    // Assert
    const names = (many.body as { people: { displayName: string }[] }).people.map((p) => p.displayName);
    expect(names).toEqual(Array.from({ length: 10 }, (_, i) => `Many ${TOKEN} ${i + 10}`));
    expect(self.body).toEqual({ people: [] });
  });

  it('[PROD-007] LIKE wildcards in the query match only themselves', async () => {
    // Arrange: a name with % and _, and one that unescaped wildcards would also match
    const literal = await personNamed(tb, `Pct ${TOKEN} 100%_x`);
    await personNamed(tb, `Pct ${TOKEN} 1000ax`);
    // Act
    const percent = await search(asker, `${TOKEN} 100%`);
    const underscore = await search(asker, `${TOKEN} 100%_`);
    const everyone = await Promise.all(['%%%', '___', '\\%_'].map((q) => search(asker, q)));
    // Assert
    expect(percent.body).toEqual({
      people: [{ userId: literal.principal.userId, displayName: `Pct ${TOKEN} 100%_x` }],
    });
    expect(underscore.body).toEqual(percent.body);
    for (const res of everyone) expect(res.body).toEqual({ people: [] });
  });

  it.each([
    ['too short', 'Zq'],
    ['two letters between spaces', '  Zq  '],
    ['too long', `Zq${'x'.repeat(99)}`],
  ])('[PROD-007] a query that is %s is 400 and is not echoed', async (_name, q) => {
    const res = await search(asker, q);
    expect([res.status, res.body.errorCode]).toEqual([400, 'error.badRequest']);
    expect(JSON.stringify(res.body)).not.toContain('Zq');
  });

  it.each([
    [
      'a student author',
      { role: 'author', overrides: { studentAuthor: true } },
      403,
      'hvl:sharing-not-allowed',
    ],
    ['a portal learner', { role: 'learner' }, 403, 'error.forbidden'],
    ['an admin-only member', { role: 'admin' }, 403, 'error.forbidden'],
    ['a Canvas launch (ltik)', { role: 'author', overrides: LTI_OVERRIDES }, 401, 'hvl:unauthenticated'],
  ] as const)('[PROD-007] %s may not search', async (_name, who, status, code) => {
    // Arrange
    const caller = await tb.principal(who.role, 'overrides' in who ? who.overrides : {});
    // Act
    const res = await search(caller, `Kari ${TOKEN}`);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([status, code]);
  });
});
