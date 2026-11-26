/**
 * Tests for the app's last error handler: a fault no route handled is logged through the logger and ended here,
 * before or after the answer has begun, and never reaches Express's own final handler.
 *
 * Spec: NFR-006, DATA-009
 */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lastResortErrorHandler } from '../../src/http/lastResortError.js';
import { capturedLogger } from '../support/capturedLogger.js';

const SECRET_ADDRESS = 'postgresql://hvli_app:db-password-1@db.hvl.no:5432/hvli';

/** An app whose routes fail before and after their answer has begun, ending in the handler under test. */
function faultyApp() {
  const log = capturedLogger();
  const app = express();
  // WHY: outside the `test` mode Express's own final handler prints the fault; the test proves it is not reached.
  app.set('env', 'development');
  app.get('/early/:id', () => {
    throw new Error(`cannot reach ${SECRET_ADDRESS}`);
  });
  app.get('/late/:id', (_req, res, next) => {
    res.status(200).type('text/plain').write('the first part');
    next(new Error(`lost ${SECRET_ADDRESS} while sending`));
  });
  app.use(lastResortErrorHandler(log.logger));
  return { app, lines: () => log.lines.map((line) => JSON.parse(line) as Record<string, unknown>) };
}

afterEach(() => vi.restoreAllMocks());

describe('[NFR-006] the last error handler', () => {
  it('[NFR-006] a fault after the answer began is logged once through the logger and the connection is closed', async () => {
    // Arrange
    const printed = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app, lines } = faultyApp();
    // Act: the client gets the first part and then a closed connection, not a second answer
    const outcome = await request(app)
      .get('/late/8f2c')
      .then(
        () => 'complete',
        (error: Error) => error.message,
      );
    // Assert
    expect(outcome).toMatch(/aborted|socket hang up|ECONNRESET/);
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({
      level: 'error',
      route: '/late/:id',
      method: 'GET',
      msg: 'request failed after its answer began',
    });
    // Assert: the address's password is not in the log, and nothing was printed around the logger
    expect(JSON.stringify(lines())).not.toContain('db-password-1');
    expect(JSON.stringify(lines())).not.toContain('8f2c');
    expect(printed).not.toHaveBeenCalled();
  });

  it('[DATA-009] a fault before the answer began gives the error page, with the fault only in the log', async () => {
    // Arrange
    const printed = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app, lines } = faultyApp();
    // Act
    const res = await request(app).get('/early/8f2c');
    // Assert
    expect(res.status).toBe(500);
    expect(res.type).toBe('text/html');
    expect(res.text).not.toMatch(/cannot reach|postgresql|at .*\.ts/);
    expect(lines().map((line) => line.level)).toEqual(['error']);
    expect(JSON.stringify(lines())).not.toContain('db-password-1');
    expect(printed).not.toHaveBeenCalled();
  });
});
