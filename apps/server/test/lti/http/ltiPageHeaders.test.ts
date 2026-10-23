/**
 * Tests for the headers of pages that run in the Canvas iframe or can carry an ltik.
 *
 * Spec: LTI-003
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { frameAncestors, ltiPageCsp, ltijsPageCsp } from '../../../src/lti/http/ltiPageHeaders.js';

const hash = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const CANVAS = ['https://hvl.instructure.com', 'https://hvl.test.instructure.com'];

describe('[LTI-003] LTI page headers', () => {
  it('[LTI-003] frame-ancestors lists exactly the Canvas origins, or none', () => {
    expect(frameAncestors(CANVAS)).toBe(
      'frame-ancestors https://hvl.instructure.com https://hvl.test.instructure.com',
    );
    expect(frameAncestors([])).toBe("frame-ancestors 'none'");
  });

  it('[LTI-003] allows ltijs inline scripts and style attributes by hash, not its JSON data blocks', () => {
    // Arrange
    const page = [
      '<script src="/static/lti/ltijsStorageGuard.js"></script>',
      '<form style="display: none;" action="" method="post"></form>',
      '<script type="application/json" id="ltijs-launch-data">{"idToken":"x"}</script>',
      '<script>\nrun();\n</script>',
    ].join('\n');
    // Act
    const csp = ltijsPageCsp(page, CANVAS);
    // Assert
    expect(csp).toContain(`script-src 'self' ${hash('\nrun();\n')}`);
    expect(csp).not.toContain(hash('{"idToken":"x"}'));
    expect(csp).toContain(`style-src 'unsafe-hashes' ${hash('display: none;')}`);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp.endsWith(frameAncestors(CANVAS))).toBe(true);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  it('[LTI-003] our own pages allow same-origin scripts only and can widen form-action', () => {
    expect(ltiPageCsp(CANVAS)).toContain("script-src 'self'; style-src 'self'");
    expect(ltiPageCsp(CANVAS)).toContain("form-action 'self'");
    const deepLink = ltiPageCsp(CANVAS, ['form-action https://hvl.instructure.com']);
    expect(deepLink).toContain('form-action https://hvl.instructure.com');
    expect(deepLink).not.toContain("form-action 'self'");
  });
});
