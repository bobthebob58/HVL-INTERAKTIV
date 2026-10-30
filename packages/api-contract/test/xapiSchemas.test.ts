/**
 * Tests the xAPI batch shapes against what H5P really sends (probe P1's curated fixtures of the ten types), and the
 * limits D-115 adds: the batch size, the statement and attempt IDs, the score checks and the answer caps.
 *
 * Spec: LTI-011, DATA-012, INS-003
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  H5P_SUBCONTENT_ID_EXTENSION,
  storedXapiResponse,
  XAPI_BATCH_MAX_STATEMENTS,
  XAPI_VERB_IDS,
  XAPI_VERB_NAMESPACE,
  XAPI_VERBS,
  xapiBatchEnvelopeSchema,
  xapiBatchSchema,
  xapiStatementItemSchema,
} from '../src/index.js';

// WHY: the statements probe P1 recorded in the real player (apps/server/test/fixtures/xapi/README.md); the contract
// must accept every one of them, so they are read here as plain JSON rather than through the server's test helpers.
const FIXTURES = new URL('../../../apps/server/test/fixtures/xapi/', import.meta.url);
const CONTENT = '01a18d96-085e-75db-ab6b-59912dfb9e9c';
const VIEW = '6f1c2b9e-3d4a-4b8c-9e7f-0a1b2c3d4e5f';

type Statement = Record<string, unknown>;
const realStatements = (): { library: string; statement: Statement }[] =>
  readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      const text = readFileSync(new URL(name, FIXTURES), 'utf8').replaceAll('{{contentId}}', CONTENT);
      const fixture = JSON.parse(text) as { library: string; statements: { statement: Statement }[] };
      return fixture.statements.map(({ statement }) => ({ library: fixture.library, statement }));
    });

const item = (statement: Statement, n = 1) => ({
  ...statement,
  statementId: crypto.randomUUID(),
  attemptId: `${VIEW}:${n}`,
});
const answered = (score: Record<string, number>, extra: Statement = {}) =>
  item({
    verb: { id: `${XAPI_VERB_NAMESPACE}answered` },
    object: { id: CONTENT, definition: { interactionType: 'choice' } },
    result: { score, response: '1' },
    ...extra,
  });
const valid = (candidate: unknown) => xapiStatementItemSchema.safeParse(candidate).success;

describe('[LTI-011] the xAPI batch the bridge posts', () => {
  it('[LTI-011] accepts every statement H5P sent for the ten types, once the bridge adds its IDs', () => {
    // Arrange
    const statements = realStatements();
    // Act
    const refused = statements.filter(({ statement }) => !valid(item(statement)));
    // Assert: nine types sent statements (ImageHotspots sends none), all of them valid
    expect(new Set(statements.map((s) => s.library)).size).toBe(9);
    expect(statements.length).toBeGreaterThan(50);
    expect(refused).toEqual([]);
  });

  it('[DATA-012] parsing drops the actor, question text, choices and every extension the server does not read', () => {
    // Arrange: a real sub-content answer, with H5P's anonymous actor and the question's texts
    const real = realStatements().find(
      ({ statement }) =>
        (statement.result as Statement | undefined)?.response !== undefined &&
        JSON.stringify(statement).includes(H5P_SUBCONTENT_ID_EXTENSION),
    )!.statement;
    // Act
    const parsed = xapiStatementItemSchema.parse(item(real));
    // Assert
    const json = JSON.stringify(parsed);
    expect(parsed).not.toHaveProperty('actor');
    expect(json).not.toMatch(/mailto|"name"|"display"|"description"|"choices"|correctResponsesPattern/);
    expect(Object.keys(parsed.object.definition?.extensions ?? {})).toEqual(
      expect.arrayContaining([H5P_SUBCONTENT_ID_EXTENSION]),
    );
    expect(Object.keys(parsed).sort()).toEqual(
      ['attemptId', 'context', 'object', 'result', 'statementId', 'verb'].sort(),
    );
  });

  it('[LTI-011] accepts exactly the five verbs, by their ADL IRIs', () => {
    // Act and assert
    expect(XAPI_VERB_IDS).toEqual(XAPI_VERBS.map((verb) => `${XAPI_VERB_NAMESPACE}${verb}`));
    for (const id of XAPI_VERB_IDS) expect(valid(item({ verb: { id }, object: { id: CONTENT } }))).toBe(true);
    expect(valid(item({ verb: { id: `${XAPI_VERB_NAMESPACE}experienced` }, object: { id: CONTENT } }))).toBe(
      false,
    );
    expect(valid(item({ verb: { id: 'answered' }, object: { id: CONTENT } }))).toBe(false);
  });

  it('[LTI-011] checks 0 ≤ raw ≤ max, 0 ≤ scaled ≤ 1, and scaled = raw / max within 0.0001 exactly when max > 0', () => {
    // Act and assert: H5P's own shapes
    expect(valid(answered({ min: 0, max: 3, raw: 2, scaled: 0.6667 }))).toBe(true);
    expect(valid(answered({ min: 0, max: 0, raw: 0 }))).toBe(true);
    expect(valid(answered({ raw: 4 }))).toBe(true);
    // Act and assert: out of range, or inconsistent
    expect(valid(answered({ max: 3, raw: 4, scaled: 1 }))).toBe(false);
    expect(valid(answered({ max: 3, raw: -1, scaled: 0 }))).toBe(false);
    expect(valid(answered({ max: 2, raw: 2, scaled: 1.5 }))).toBe(false);
    expect(valid(answered({ max: 3, raw: 2, scaled: 0.6 }))).toBe(false);
    expect(valid(answered({ max: 3, raw: 2 }))).toBe(false);
    expect(valid(answered({ max: 0, raw: 0, scaled: 0 }))).toBe(false);
  });

  it('[LTI-011] needs a statement UUID and a `<viewId>:<n>` attempt, and allows a missing context and a numeric answer', () => {
    // Arrange
    const base = { verb: { id: `${XAPI_VERB_NAMESPACE}completed` }, object: { id: CONTENT } };
    // Act and assert
    expect(valid({ ...item(base), statementId: 'not-a-uuid' })).toBe(false);
    expect(valid({ ...item(base), attemptId: VIEW })).toBe(false);
    expect(valid({ ...item(base), attemptId: `${VIEW}:0` })).toBe(false);
    expect(valid({ ...item(base), attemptId: `${VIEW.toUpperCase()}:1` })).toBe(false);
    expect(valid({ ...item(base), attemptId: `${VIEW}:1000000` })).toBe(false);
    expect(valid(item(base, 999_999))).toBe(true);
    expect(valid(item({ ...base, result: { response: 2 } }))).toBe(true);
  });

  it('[LTI-011] a batch names one activity and version and holds 1 to 50 items; the envelope leaves items to be checked one by one', () => {
    // Arrange
    const batch = (statements: unknown[], extra: object = {}) => ({
      contentId: CONTENT,
      contentVersion: 2,
      statements,
      ...extra,
    });
    const items = (n: number) => Array.from({ length: n }, () => answered({ max: 1, raw: 1, scaled: 1 }));
    // Act and assert
    expect(xapiBatchSchema.safeParse(batch(items(XAPI_BATCH_MAX_STATEMENTS))).success).toBe(true);
    expect(xapiBatchSchema.safeParse(batch(items(XAPI_BATCH_MAX_STATEMENTS + 1))).success).toBe(false);
    expect(xapiBatchSchema.safeParse(batch([])).success).toBe(false);
    expect(xapiBatchSchema.safeParse(batch(items(1), { contentVersion: 0 })).success).toBe(false);
    expect(xapiBatchSchema.safeParse(batch(items(1), { learnerKey: 'k' })).success).toBe(false);
    expect(xapiBatchEnvelopeSchema.safeParse(batch([{ odd: true }, ...items(1)])).success).toBe(true);
    expect(xapiBatchSchema.safeParse(batch([{ odd: true }, ...items(1)])).success).toBe(false);
    // WHY: the server parses the envelope first (D-115), so its own bounds are the ones that refuse a batch
    expect(xapiBatchEnvelopeSchema.safeParse(batch(items(XAPI_BATCH_MAX_STATEMENTS))).success).toBe(true);
    expect(xapiBatchEnvelopeSchema.safeParse(batch(items(XAPI_BATCH_MAX_STATEMENTS + 1))).success).toBe(
      false,
    );
    expect(xapiBatchEnvelopeSchema.safeParse(batch([])).success).toBe(false);
  });

  it('[LTI-011] refuses an item with U+0000 in text the server stores, which PostgreSQL text cannot hold', () => {
    // Arrange: one odd item must be discarded alone, never fail its whole batch's insert (D-115)
    const fillIn = (response: string, subContentId = 'q1', objectId = CONTENT) =>
      item({
        verb: { id: `${XAPI_VERB_NAMESPACE}answered` },
        object: {
          id: objectId,
          definition: {
            interactionType: 'fill-in',
            extensions: { [H5P_SUBCONTENT_ID_EXTENSION]: subContentId },
          },
        },
        result: { response },
      });
    // Act and assert
    expect(valid(fillIn('teksting[,]lydspor'))).toBe(true);
    expect(valid(fillIn('teks\u0000ting'))).toBe(false);
    expect(valid(fillIn('teksting', 'q\u00001'))).toBe(false);
    expect(valid(fillIn('teksting', 'q1', `${CONTENT}?subContentId=q\u00001`))).toBe(false);
  });
});

describe('[DATA-012] the answers that are stored', () => {
  it('[INS-003] keeps choice and gap answers only, numbers as text, with every gap position kept', () => {
    // Act and assert
    expect(storedXapiResponse('0[,]2', 'choice')).toBe('0[,]2');
    expect(storedXapiResponse('teksting[,]lydspor[,]', 'fill-in')).toBe('teksting[,]lydspor[,]');
    expect(storedXapiResponse(3, 'choice')).toBe('3');
    expect(storedXapiResponse('1', 'true-false')).toBeNull();
    expect(storedXapiResponse('1', undefined)).toBeNull();
    expect(storedXapiResponse(undefined, 'choice')).toBeNull();
  });

  it('[DATA-012] cuts each gap to 100 characters by code point and drops an answer still over 1 000', () => {
    // Arrange: probe P1's 5 000-character gap, a gap of emoji, and eleven full gaps
    const long = 'a'.repeat(5000);
    const emoji = '😀'.repeat(150);
    const elevenGaps = Array.from({ length: 11 }, () => 'b'.repeat(100)).join('[,]');
    // Act
    const cut = storedXapiResponse(`${long}[,]kort`, 'fill-in');
    const cutEmoji = storedXapiResponse(emoji, 'fill-in');
    // Assert
    expect(cut).toBe(`${'a'.repeat(100)}[,]kort`);
    expect(Array.from(cutEmoji ?? '')).toHaveLength(100);
    expect(cutEmoji).toBe('😀'.repeat(100));
    expect(storedXapiResponse(elevenGaps, 'fill-in')).toBeNull();
    expect(storedXapiResponse(elevenGaps.slice(0, 1000), 'fill-in')).toHaveLength(1000);
  });
});
