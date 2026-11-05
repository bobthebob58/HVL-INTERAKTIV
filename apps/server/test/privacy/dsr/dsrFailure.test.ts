/**
 * Tests for what the data-subject CLI prints when a run fails (DATA-008, DATA-009, D-108's amendments of 2026-11-04 and
 * 2026-11-05): real Prisma errors, whose messages quote the query's learnerKeys, are printed by name and code only;
 * other errors by name and code; configuration and input problems by their own value-free message.
 *
 * Spec: DATA-008, DATA-009
 */
import { afterAll, describe, expect, it } from 'vitest';
import { InvalidEnvironmentError } from '../../../src/config/env.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { DataSubjectInputError } from '../../../src/privacy/dsr/dataSubject.js';
import { describeFailure } from '../../../src/privacy/dsr/dsrFailure.js';

const KEY = 'kari-learner-key-0000000000000000000000000';
// WHY: nothing listens on port 1, so the query fails as an unreachable database does, without any test service.
const unreachable = createPrismaClient('postgresql://nobody:nothing@127.0.0.1:1/none');

/** What a call throws. */
const thrownBy = async (call: () => Promise<unknown>): Promise<unknown> =>
  call().then(
    () => {
      throw new Error('the call did not fail');
    },
    (error: unknown) => error,
  );

describe('[DATA-008] describeFailure', () => {
  afterAll(() => unreachable.$disconnect());

  it('[DATA-009] prints real Prisma errors by name and code, never a message, which can render the learnerKey', async () => {
    // Arrange
    const where = { learnerKey: { in: [KEY] } };
    const lost = await thrownBy(() => unreachable.xapiStatement.findMany({ where }));
    const invalid = await thrownBy(() =>
      unreachable.h5PUserData.findMany({ where: { ...where, bogus: 1 } as never }),
    );
    // Act
    const lines = [describeFailure(lost), describeFailure(invalid)];
    // Assert: the validation error renders the query's arguments, so printing its message would show the key.
    expect((invalid as Error).message).toContain(KEY);
    expect(lines).toEqual(['PrismaClientKnownRequestError P1001', 'PrismaClientValidationError']);
  });

  it('[DATA-009] prints any other error by name and string code, and a thrown value as Error', () => {
    // Arrange
    const refused = Object.assign(new Error(`connect ECONNREFUSED for ${KEY}`), { code: 'ECONNREFUSED' });
    const plain = new TypeError(`bad ${KEY}`);
    // Act
    const lines = [refused, plain, KEY, null].map(describeFailure);
    // Assert
    expect(lines).toEqual(['Error ECONNREFUSED', 'TypeError', 'Error', 'Error']);
  });

  it('[DATA-008] prints configuration and input problems by their own message, which names variables and fields', () => {
    // Arrange
    const config = new InvalidEnvironmentError(['PSEUDONYM_SECRETS: no secrets given']);
    const input = new DataSubjectInputError(
      'lti[1].sub must be 1–255 characters without spaces at either end',
    );
    // Act and assert
    expect([describeFailure(config), describeFailure(input)]).toEqual([config.message, input.message]);
  });
});
