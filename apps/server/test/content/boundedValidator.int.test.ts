/**
 * Integration tests that a stored activity past the limits for one activity (D-127) is answered by the findings
 * list with the one `V-SIZE` finding and cannot be published without a reason, while the validator reads nothing
 * of it; an activity within the limits is checked as before.
 *
 * Spec: UD-020, SEC-005, PROD-003
 */
import { findingsResponseSchema, publishBlockedBodySchema } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SIZE_RULE_ID } from '../../src/content/boundedValidator.js';
import { CONTENT_LIMITS } from '../../src/h5p/semantics/contentBudget.js';
import type { ValidationInput } from '../../src/validation/types.js';
import { openApiTestbed, type TestPrincipal } from '../support/apiTestbed.js';
import { altError, checkedUpdatedAt, contentApi } from '../support/publishFixtures.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[UD-020] a stored activity past the limits and the publish flow', () => {
  const tb = openApiTestbed();
  let author: TestPrincipal;
  const seen: ValidationInput[] = [];
  /** An activity whose stored row holds a text no save can have stored. */
  const oversized = async (): Promise<string> => {
    const id = await tb.content(author.principal.userId);
    const params = { question: 'a'.repeat(CONTENT_LIMITS.textLength + 1) };
    await tb.db.h5PContent.update({ where: { id }, data: { params } });
    return id;
  };

  beforeAll(async () => {
    author = await tb.principal('author');
    tb.validator = (input) => (seen.push(input), [altError]);
  });
  afterAll(() => tb.close());

  it('[UD-020] the findings list answers with the one finding, and the validator reads nothing', async () => {
    // Arrange
    const id = await oversized();
    seen.length = 0;
    // Act
    const res = await contentApi(tb, 'get', `${id}/findings`, author);
    // Assert
    expect(res.status).toBe(200);
    expect(findingsResponseSchema.parse(res.body).findings).toEqual([
      {
        ruleId: SIZE_RULE_ID,
        severity: 'error',
        requirement: 'SEC-005',
        path: '',
        message: 'Aktiviteten er for stor til å bli sjekka. Del innhaldet på fleire aktivitetar.',
        acknowledgement: null,
      },
    ]);
    expect(seen).toEqual([]);
  });

  it('[PROD-003] publishing it is blocked like any error, and it stays a draft', async () => {
    // Arrange
    const id = await oversized();
    const updatedAt = await checkedUpdatedAt(tb, id, author);
    // Act
    const res = await contentApi(tb, 'post', `${id}/publish`, author).send({
      updatedAt,
      acknowledgements: [],
    });
    // Assert
    expect(res.status).toBe(409);
    const body = publishBlockedBodySchema.parse(res.body);
    expect(body.errorCode).toBe('hvl:publish-blocked');
    expect(body.findings.map((finding) => finding.ruleId)).toEqual([SIZE_RULE_ID]);
    expect((await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).status).toBe('draft');
  });

  it('[UD-020] an activity within the limits is read by the validator as before', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    seen.length = 0;
    // Act
    const res = await contentApi(tb, 'get', `${id}/findings`, author);
    // Assert
    expect(findingsResponseSchema.parse(res.body).findings).toEqual([{ ...altError, acknowledgement: null }]);
    expect(seen).toHaveLength(1);
  });
});
