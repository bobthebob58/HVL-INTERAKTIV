/**
 * Integration tests of the rule for typed text (D-142) on the routes that take it: the learning-design fields, a
 * reason for publishing and the people search answer 400 for a control character, a hidden line break or a
 * bidirectional control, write no error line, and store nothing; and a stored purpose that breaks the rule is not
 * handed to learners.
 *
 * Spec: PED-030, PED-032, UD-022, PROD-007
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { learnerInfoFields } from '../../../src/learningDesign/metadata/learnerInfoFields.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';

/** Characters nobody types on purpose (packages/api-contract/src/textRules.ts). */
const NEVER: readonly (readonly [string, string])[] = [
  ['U+0000', '\u0000'],
  ['the line separator U+2028', ' '],
  ['a right-to-left override', '‮'],
  ['an escape character', '\u001B'],
];
const PINO_ERROR = 50;

describeWithServices('[PED-030] typed text on the routes that take it', () => {
  const log = capturedLogger();
  const tb = openApiTestbed({ logger: log.logger });
  let author: TestPrincipal;
  let contentId = '';
  const design = (fields: object) =>
    requestAs(tb.app, author, 'put', `/api/content/${contentId}/learning-design`).send({
      outcomes: [],
      updatedAt: null,
      ...fields,
    });
  const stored = () => tb.db.learningDesignMetadata.findUnique({ where: { contentId } });
  const errorLines = () =>
    log.lines.filter((line) => (JSON.parse(line) as { level: number }).level >= PINO_ERROR);

  beforeAll(async () => {
    author = await tb.principal('author');
    contentId = await tb.content(author.principal.userId);
  });
  afterAll(() => tb.close());

  it.each(NEVER)(
    '[PED-030] %s in a learning-design field is a 400, and nothing is stored',
    async (_what, c) => {
      // Act
      const answers = [
        await design({ rationale: `Fordi${c}det` }),
        await design({ learnerPurpose: `Kvifor${c}dette` }),
        await design({ outcomes: [{ text: `Forklare${c}blodtrykk`, category: 'kunnskap' }] }),
      ];
      // Assert
      expect(answers.map((res) => res.status)).toEqual([400, 400, 400]);
      expect(answers.map((res) => res.body.errorCode)).toEqual(Array(3).fill('error.badRequest'));
      expect(await stored()).toBeNull();
      expect(errorLines()).toEqual([]);
    },
  );

  it.each(NEVER)('[UD-022] %s in a reason for publishing is a 400', async (_what, c) => {
    // Act
    const res = await requestAs(tb.app, author, 'post', `/api/content/${contentId}/publish`).send({
      updatedAt: new Date().toISOString(),
      acknowledgements: [{ ruleId: 'UD-001', path: 'params.text', reason: `Fordi${c}det` }],
    });
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([400, 'error.badRequest']);
    expect(errorLines()).toEqual([]);
  });

  it.each(NEVER)('[PROD-007] %s in a people search is a 400, not a failed search', async (_what, c) => {
    // Act
    const res = await requestAs(tb.app, author, 'get', `/api/people?q=${encodeURIComponent(`Kar${c}i`)}`);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([400, 'error.badRequest']);
    expect(errorLines()).toEqual([]);
  });

  it('[PED-030] typed text with line breaks, a soft hyphen and an emoji is stored as written', async () => {
    // Arrange
    const rationale = 'Fyrste linje\nandre\tlinje\nlærings­utbyte 👩‍⚕️';
    // Act
    const res = await design({ rationale, learnerPurpose: 'Øv på blodtrykk – «kvifor»?' });
    // Assert
    expect(res.status).toBe(200);
    expect(await stored()).toMatchObject({ rationale, learnerPurpose: 'Øv på blodtrykk – «kvifor»?' });
  });

  it('[PED-032] a stored purpose that breaks the rule is not handed to learners', () => {
    // Act
    const shown = ['Kvifor dette', 'Kvifor‮dette', 'Kvifor\u0000dette', 'Kvifor dette'].map(
      (learnerPurpose) => learnerInfoFields({ estimatedStudentMinutes: 10, learnerPurpose }),
    );
    // Assert
    expect(shown).toEqual([
      { estimatedStudentMinutes: 10 },
      { estimatedStudentMinutes: 10 },
      { estimatedStudentMinutes: 10 },
      { estimatedStudentMinutes: 10, learnerPurpose: 'Kvifor dette' },
    ]);
  });
});
