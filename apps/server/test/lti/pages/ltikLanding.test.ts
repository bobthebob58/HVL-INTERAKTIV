/**
 * Tests that the player page script removes the ltik from the address bar and keeps everything else.
 *
 * Spec: LTI-003
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const SCRIPT = readFileSync(new URL('../../../src/lti/pages/client/ltikLanding.js', import.meta.url), 'utf8');

/** Runs the page script against a fake window at `href` and returns the replaceState calls. */
const landOn = (href: string): unknown[][] => {
  const calls: unknown[][] = [];
  const window = {
    location: { href },
    history: { state: { kept: true }, replaceState: (...args: unknown[]) => void calls.push(args) },
  };
  runInNewContext(SCRIPT, { window, URL });
  return calls;
};

describe('[LTI-003] ltik landing script', () => {
  it('[LTI-003] replaces the history entry with the same URL without the ltik', () => {
    const calls = landOn('http://localhost:3000/lti/play?ltik=eyJ.a.b&lang=nb#top');
    expect(calls).toEqual([[{ kept: true }, '', '/lti/play?lang=nb#top']]);
  });

  it('[LTI-003] does nothing when the URL has no ltik', () => {
    expect(landOn('http://localhost:3000/lti/play?lang=nb')).toEqual([]);
  });

  it('[LTI-003] removes every ltik parameter, however often it appears', () => {
    expect(landOn('http://localhost:3000/lti/play?ltik=a&ltik=b')[0]?.[2]).toBe('/lti/play');
  });
});
