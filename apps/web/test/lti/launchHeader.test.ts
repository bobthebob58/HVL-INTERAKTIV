/**
 * Tests for reading the launch Express passes to `/app/play`: the encoded JSON with exactly the expected types (the
 * activity's language optional) is a launch; anything missing, malformed or of another type is no launch.
 *
 * Spec: LTI-006, LTI-003, UD-010
 */
import { describe, expect, it } from 'vitest';
import { LAUNCH_HEADER, parseLaunch } from '../../src/lti/launchHeader';

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
  ])('[LTI-003] treats %s as no launch', (_case, value) => {
    expect(parseLaunch(value)).toBeUndefined();
  });
});
