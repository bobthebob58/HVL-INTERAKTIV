/**
 * Tests that ltijs's log calls reach our logger with its redaction.
 *
 * Spec: DATA-009
 */
import { describe, expect, it } from 'vitest';
import { ltijsLogger } from '../../src/lti/ltijsLogger.js';
import { capturedLogger } from '../support/capturedLogger.js';

describe('[DATA-009] ltijs logging', () => {
  it('[DATA-009] writes ltijs lines as JSON with the component and without tokens', () => {
    // Arrange
    const { logger, lines } = capturedLogger('debug');
    const log = ltijsLogger(logger);
    // Act
    log.debug('Oidc', 'Token validated for [https://canvas.example]');
    log.error('Launch', 'redirect to /lti/play?ltik=eyJabc.def.ghi failed for kari@example.org');
    // Assert
    const [debug, error] = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(debug).toMatchObject({ level: 'debug', module: 'ltijs', ltijsComponent: 'Oidc' });
    expect(error).toMatchObject({ level: 'error', ltijsComponent: 'Launch' });
    expect(String(error?.msg)).not.toMatch(/eyJabc|kari@example\.org/);
  });
});
