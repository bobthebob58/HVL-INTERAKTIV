/**
 * Tests for the bridge's statement rules on probe P1's recordings of the ten real types: which statements are about
 * the activity itself and which carry a gradable root result (D-115's table), how a statement is cut down (nothing
 * about the learner or the content's texts survives), and that the answer caps equal the server's.
 *
 * Spec: LTI-010, DATA-012
 */
import { storedXapiResponse, xapiStatementItemSchema } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_ID,
  openBridgeDocument,
  p1Fixture,
  statement,
  type Statement,
} from './support/bridgeDocument.js';

interface Rules {
  verbOf(s: unknown): string;
  isRoot(s: unknown, contentId: string): boolean;
  isGradable(s: unknown, contentId: string, mainLibrary: string): boolean;
  cut(s: Statement): Record<string, unknown>;
}
const rules = (openBridgeDocument({ config: null }).dom.window as unknown as { hvliXapiStatements: Rules })
  .hvliXapiStatements;

/** D-115's gradable root results, as `view verb raw/max`, in the order P1 recorded them. */
const GRADABLE: [string, string[]][] = [
  ['H5P.MultiChoice', ['1 answered 1/1']],
  ['H5P.Blanks', ['1 answered 6/7']],
  ['H5P.DragText', ['1 answered 3/4']],
  ['H5P.QuestionSet', ['1 completed 6/9']],
  ['H5P.Column', ['1 completed 1/2']],
  // WHY: view 2's is CoursePresentation's replay on resume; only the server can tell (D-115).
  ['H5P.CoursePresentation', ['1 completed 1/1', '2 completed 1/1']],
  ['H5P.InteractiveBook', ['1 completed 1/4']],
  ['H5P.ImageHotspots', []],
  ['H5P.BranchingScenario', ['1 completed 10/10']],
  ['H5P.InteractiveVideo', []],
];

const ALLOWED_KEYS = new Set([
  'verb',
  'object',
  'context',
  'result',
  'id',
  'definition',
  'interactionType',
  'extensions',
  'http://h5p.org/x-api/h5p-local-content-id',
  'http://h5p.org/x-api/h5p-subContentId',
  'contextActivities',
  'parent',
  'category',
  'score',
  'raw',
  'max',
  'min',
  'scaled',
  'success',
  'completion',
  'duration',
  'response',
]);
const keysOf = (value: unknown): string[] =>
  typeof value !== 'object' || value === null
    ? []
    : Object.entries(value).flatMap(([k, v]) => [...(Array.isArray(value) ? [] : [k]), ...keysOf(v)]);

describe('[LTI-010] the bridge’s statement rules on P1’s recordings', () => {
  it.each(GRADABLE)(
    '[LTI-010] %s: the gradable root results are those of D-115’s table',
    (type, expected) => {
      // Arrange
      const { library, statements } = p1Fixture(type);
      // Act
      const gradable = statements
        .filter(({ statement: s }) => rules.isGradable(s, CONTENT_ID, library))
        .map(({ view, statement: s }) => {
          const score = (s.result as { score: { raw: number; max: number } }).score;
          return `${view} ${rules.verbOf(s)} ${score.raw}/${score.max}`;
        });
      // Assert
      expect(gradable).toEqual(expected);
    },
  );

  const SUB_EXTENSION = { 'http://h5p.org/x-api/h5p-subContentId': 'a1' };
  it.each([
    ['the activity itself', statement('answered'), true],
    ['an attempted without context', statement('attempted', { context: undefined }), true],
    [
      'a part named in object.id',
      statement('answered', { object: { id: `${CONTENT_ID}?subContentId=a1` } }),
      false,
    ],
    [
      'a part named by the extension',
      statement('answered', { object: { id: CONTENT_ID, definition: { extensions: SUB_EXTENSION } } }),
      false,
    ],
    [
      'a statement with a parent',
      statement('completed', { context: { contextActivities: { parent: [{ id: CONTENT_ID }] } } }),
      false,
    ],
  ] as const)('[LTI-010] root needs all three structural tests: %s gives %s', (_name, sent, root) => {
    expect(rules.isRoot(sent, CONTENT_ID)).toBe(root);
  });

  const scored = (max: number) => ({ result: { score: { raw: 0, max, min: 0 } } });
  it.each([
    ['a root answered of the main library', statement('answered', scored(1)), 'H5P.MultiChoice 1.16', true],
    ['a maximum of 0', statement('answered', scored(0)), 'H5P.MultiChoice 1.16', false],
    ['another main library', statement('answered', scored(1)), 'H5P.QuestionSet 1.21', false],
    ['an interacted', statement('interacted', scored(1)), 'H5P.MultiChoice 1.16', false],
  ] as const)('[LTI-010] a gradable root result: %s gives %s', (_name, sent, library, gradable) => {
    expect(rules.isGradable(sent, CONTENT_ID, library)).toBe(gradable);
  });

  it('[DATA-012] a cut statement keeps only what the server reads, and every one P1 recorded passes the schema', () => {
    // Arrange
    const all = GRADABLE.flatMap(([type]) => p1Fixture(type).statements.map((s) => s.statement));
    // Act
    const cut = all.map((s) => rules.cut(s));
    // Assert
    expect([...new Set(cut.flatMap(keysOf))].filter((key) => !ALLOWED_KEYS.has(key))).toEqual([]);
    for (const item of cut) {
      const parsed = xapiStatementItemSchema.safeParse({
        ...item,
        statementId: '0192f0c4-0000-4000-8000-000000000001',
        attemptId: '0192f0c4-0000-4000-8000-000000000002:1',
      });
      expect(parsed.success, JSON.stringify(item)).toBe(true);
    }
    expect(JSON.stringify(cut)).not.toMatch(/mailto|en-US|undervegsvurdering\?/);
  });

  it.each([
    ['0[,]2', 'choice'],
    [3, 'choice'],
    [`${'å'.repeat(150)}[,][,]${'x'.repeat(20)}`, 'fill-in'],
    [`${'😀'.repeat(120)}`, 'fill-in'],
    [Array(11).fill('y'.repeat(100)).join('[,]'), 'fill-in'],
    ['long text', 'long-fill-in'],
    ['0', undefined],
  ] as const)('[DATA-012] caps the answer %#, as the server stores it', (response, interactionType) => {
    // Arrange
    const sent = statement('answered', {
      object: { id: CONTENT_ID, definition: interactionType ? { interactionType } : {} },
      result: { response },
    });
    // Act
    const kept = (rules.cut(sent).result as { response?: string } | undefined)?.response;
    // Assert
    expect(kept ?? null).toBe(storedXapiResponse(response, interactionType));
  });

  it.each([null, 1, 'x', [], {}, { verb: 'answered' }, { verb: { id: 3 }, object: null }])(
    '[LTI-010] never throws on %o',
    (odd) => {
      expect(() => [
        rules.verbOf(odd),
        rules.isRoot(odd, CONTENT_ID),
        rules.isGradable(odd, CONTENT_ID, 'H5P.X 1.0'),
      ]).not.toThrow();
    },
  );

  it('[LTI-010] changes nothing it is given', () => {
    // Arrange
    const given = statement('answered', { result: { score: { raw: 1, max: 1, scaled: 1 }, response: '0' } });
    const before = JSON.stringify(given);
    // Act
    rules.cut(given);
    // Assert
    expect(JSON.stringify(given)).toBe(before);
  });
});
