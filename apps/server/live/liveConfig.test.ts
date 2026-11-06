/**
 * Tests of the live-contract seam's configuration: when the checks run, against what, and that a mistake fails loudly
 * without printing a value (D-101's amendment of 2026-11-05). These run with every live run, also when every check
 * is skipped.
 *
 * Spec: LTI-012, LTI-008, AUTH-001
 */
import { describe, expect, it } from 'vitest';
import { livePlanOf, LiveConfigError, runsCanvas, runsFeide } from './liveConfig.js';

const CANVAS = Object.freeze({
  LIVE_CANVAS_ISSUER: 'https://canvas.test.instructure.com',
  LIVE_CANVAS_CLIENT_ID: '10000000000001',
  LIVE_CANVAS_API_ORIGIN: 'https://hvl.test.instructure.com',
  LIVE_CANVAS_COURSE_ID: '123',
  LIVE_DATABASE_URL: 'postgresql://reader:secret-password@test-db.example/hvli',
  LIVE_DATA_ENCRYPTION_KEYS: 'k1:secret-key-material',
});

describe('LTI-012 when the live-contract checks run', () => {
  it('[LTI-012] runs nothing when no live variable is set', () => {
    // Act
    const plan = livePlanOf({ DATABASE_URL: 'postgresql://local/hvli' });
    // Assert
    expect(plan).toEqual({ kind: 'none' });
    expect([runsCanvas(plan), runsFeide(plan)]).toEqual([false, false]);
  });

  it('[LTI-012] reads a whole Canvas target, with the suffix label mode by default', () => {
    // Act
    const plan = livePlanOf({ ...CANVAS, LIVE_CANVAS_API_ORIGIN: 'https://hvl.test.instructure.com/' });
    // Assert
    expect(plan.kind === 'live' && plan.canvas).toMatchObject({
      issuer: CANVAS.LIVE_CANVAS_ISSUER,
      apiOrigin: 'https://hvl.test.instructure.com',
      courseId: '123',
      studentSub: undefined,
      labelMode: 'suffix',
    });
    expect([runsCanvas(plan), runsFeide(plan)]).toEqual([true, false]);
  });

  it('[LTI-012] fails a Canvas target set in part, naming the missing variables but no value', () => {
    // Act
    const reading = () =>
      livePlanOf({ LIVE_CANVAS_ISSUER: CANVAS.LIVE_CANVAS_ISSUER, LIVE_CANVAS_STUDENT_SUB: 'x' });
    // Assert
    expect(reading).toThrow(LiveConfigError);
    expect(reading).toThrow(
      /LIVE_CANVAS_CLIENT_ID, LIVE_CANVAS_API_ORIGIN, LIVE_CANVAS_COURSE_ID, LIVE_DATABASE_URL/,
    );
    expect(reading).not.toThrow(/canvas\.test\.instructure/);
    expect(() => livePlanOf({ LIVE_AGS_LABEL_MODE: 'preserve' }), 'an optional one alone').toThrow(
      LiveConfigError,
    );
  });

  it.each([
    ['LIVE_CANVAS_ISSUER', 'http://canvas.test.instructure.com', /must use https/],
    ['LIVE_CANVAS_API_ORIGIN', 'https://hvl.test.instructure.com/api', /origin only/],
    ['LIVE_CANVAS_API_ORIGIN', 'not a url', /not a URL/],
    ['LIVE_AGS_LABEL_MODE', 'both', /suffix, preserve/],
  ])('[LTI-012] refuses %s = %s', (name, value, message) => {
    // Act and assert
    expect(() => livePlanOf({ ...CANVAS, [name]: value })).toThrow(message);
  });

  it('[LTI-012] never puts a secret value into an error', () => {
    // Act
    const reading = () => livePlanOf({ ...CANVAS, LIVE_CANVAS_ISSUER: 'http://secret-password.example' });
    // Assert
    expect(reading).toThrow(/LIVE_CANVAS_ISSUER/);
    expect(reading).not.toThrow(/secret/);
  });

  it('[LTI-008] runs the mock target for LIVE_TARGET=mock, and refuses it beside a real target', () => {
    // Act
    const plan = livePlanOf({ LIVE_TARGET: 'mock' });
    // Assert
    expect([runsCanvas(plan), runsFeide(plan)]).toEqual([true, true]);
    expect(() => livePlanOf({ ...CANVAS, LIVE_TARGET: 'mock' })).toThrow(/cannot be combined/);
    expect(() => livePlanOf({ LIVE_TARGET: 'canvas' })).toThrow(/may only be mock/);
  });

  it('[AUTH-001] runs only the Feide checks for LIVE_FEIDE_ISSUER alone, and only over https', () => {
    // Act
    const plan = livePlanOf({ LIVE_FEIDE_ISSUER: 'https://auth.dataporten.no/' });
    // Assert
    expect(plan).toEqual({ kind: 'live', canvas: undefined, feideIssuer: 'https://auth.dataporten.no' });
    expect([runsCanvas(plan), runsFeide(plan)]).toEqual([false, true]);
    expect(() => livePlanOf({ LIVE_FEIDE_ISSUER: 'http://auth.dataporten.no' })).toThrow(/https/);
  });
});
