/**
 * Tests that ltijs's log calls reach our logger with its redaction.
 *
 * Spec: DATA-009
 */
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../src/logging/logger.js';
import { ltijsLogger } from '../../src/lti/ltijsLogger.js';

describe('[DATA-009] ltijs logging', () => {
  it('[DATA-009] writes ltijs lines as JSON with the component and without tokens', () => {
    // Arrange
    const lines: string[] = [];
    const destination = new Writable({ write: (chunk, _e, done) => (lines.push(String(chunk)), done()) });
    const log = ltijsLogger(createLogger({ level: 'debug', destination }));
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
