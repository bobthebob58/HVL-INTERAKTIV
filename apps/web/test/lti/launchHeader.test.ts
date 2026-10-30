/**
 * Tests for reading the launch Express passes to `/app/play`: the encoded JSON with exactly the expected types (the
 * activity's language, minutes and purpose optional) is a launch; anything missing, unknown, malformed, out of
 * bounds or of another type is no launch.
 *
 * Spec: LTI-006, LTI-003, UD-010, PED-032
 */
import { LEARNER_PURPOSE_MAX_LENGTH, MAX_STUDENT_MINUTES } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  LAUNCH_HEADER,
  LAUNCH_MINUTES_MAX,
  LAUNCH_PURPOSE_MAX_LENGTH,
  parseLaunch,
} from '../../src/lti/launchHeader';

const launch = {
  contentId: '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f',
  title: 'Kva er ein celle? ✓',
  mayEdit: true,
  locale: 'nn',
};
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe('[LTI-006] the launch header', () => {
  it('[LTI-006] reads the launch, also with a title outside Latin-1', () => {
    expect(LAUNCH_HEADER).toBe('x-hvli-launch');
    expect(parseLaunch(encode(launch))).toEqual(launch);
  });

  it('[UD-010] reads the activity’s own language when Express sends it', () => {
    expect(parseLaunch(encode({ ...launch, language: 'en-GB' }))).toEqual({ ...launch, language: 'en-GB' });
  });

  it.each([
    ['no header', null],
    ['an empty header', ''],
    ['broken encoding', '%E0%A4%A'],
    ['not JSON', encodeURIComponent('{nope')],
    ['an array', encode([launch])],
    ['a contentId that is not a UUID', encode({ ...launch, contentId: '../x' })],
    ['mayEdit as text', encode({ ...launch, mayEdit: 'true' })],
    ['an unknown locale', encode({ ...launch, locale: 'de' })],
    ['a title that is not text', encode({ ...launch, title: 7 })],
    ['a language that is not a tag', encode({ ...launch, language: 'nn"><x' })],
    ['a language that is not text', encode({ ...launch, language: 1 })],
    ['a language tag over 35 characters', encode({ ...launch, language: `en-${'abcdefgh-'.repeat(4)}x` })],
    ['an unknown key', encode({ ...launch, rationale: 'Berre for forfattaren' })],
    ['0 minutes', encode({ ...launch, estimatedStudentMinutes: 0 })],
    ['601 minutes', encode({ ...launch, estimatedStudentMinutes: 601 })],
    ['minutes that are not whole', encode({ ...launch, estimatedStudentMinutes: 1.5 })],
    ['minutes as text', encode({ ...launch, estimatedStudentMinutes: '15' })],
    ['an empty purpose', encode({ ...launch, learnerPurpose: '  ' })],
    ['a purpose of 201 characters', encode({ ...launch, learnerPurpose: 'x'.repeat(201) })],
    ['a purpose on two lines', encode({ ...launch, learnerPurpose: 'Ein\nTo' })],
    ['a purpose with a control character', encode({ ...launch, learnerPurpose: 'Ein\u0007' })],
    ['a purpose that is not text', encode({ ...launch, learnerPurpose: ['Ein'] })],
  ])('[LTI-003] treats %s as no launch', (_case, value) => {
    expect(parseLaunch(value)).toBeUndefined();
  });
});

describe('[PED-032] the learner info in the launch header', () => {
  it('[PED-032] reads the estimated minutes and the purpose at their limits', () => {
    // Arrange
    const full = {
      ...launch,
      language: 'en',
      estimatedStudentMinutes: 600,
      learnerPurpose: `Kvifor? ${'x'.repeat(192)}`,
    };
    // Act and assert
    expect(parseLaunch(encode(full))).toEqual(full);
    expect(parseLaunch(encode({ ...launch, estimatedStudentMinutes: 1 }))).toEqual({
      ...launch,
      estimatedStudentMinutes: 1,
    });
  });

  it('[PED-032] mirrors the contract’s limits', () => {
    expect([LAUNCH_MINUTES_MAX, LAUNCH_PURPOSE_MAX_LENGTH]).toEqual([
      MAX_STUDENT_MINUTES,
      LEARNER_PURPOSE_MAX_LENGTH,
    ]);
  });
});
