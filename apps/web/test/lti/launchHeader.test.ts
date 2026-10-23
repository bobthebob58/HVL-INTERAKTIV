/**
 * Tests for reading the launch Express passes to `/app/play`: the encoded JSON with exactly the expected types is a
 * launch; anything missing, malformed or of another type is no launch.
 *
 * Spec: LTI-006, LTI-003
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
  ])('[LTI-003] treats %s as no launch', (_case, value) => {
    expect(parseLaunch(value)).toBeUndefined();
  });
});
