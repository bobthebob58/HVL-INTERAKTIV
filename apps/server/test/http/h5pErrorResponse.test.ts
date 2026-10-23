/**
 * Tests for turning route errors into translated H5P error answers without leaking internal messages.
 *
 * Spec: PROD-012, H5P-002, H5P-006, SEC-005
 */
import { H5pError } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import { t } from '../../src/i18n/translate.js';
import { HttpError } from '../../src/http/HttpError.js';
import { toErrorResponse } from '../../src/http/h5pErrorResponse.js';
import { UnsafeObjectNameError } from '../../src/h5p/storage/s3Objects.js';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';
import { ZipRejectedError } from '../../src/security/zipEntryGuard.js';

describe('toErrorResponse', () => {
  it('[PROD-012] an HttpError keeps its status and message key, in the requested language', () => {
    // Act and assert: the same error in each of the three languages.
    for (const locale of ['nn', 'nb', 'en'] as const) {
      expect(toErrorResponse(new HttpError(401, 'error.unauthenticated'), locale)).toEqual({
        status: 401,
        body: {
          success: false,
          errorCode: 'error.unauthenticated',
          httpStatusCode: 401,
          message: t('error.unauthenticated', {}, locale),
        },
      });
    }
  });

  it('[H5P-002] HVL’s Lumi errors get their own messages with the replacements filled in', () => {
    const error = new H5pError('hvl:content-type-not-allowed', { library: 'H5P.TrueFalse' }, 403);
    const { status, body } = toErrorResponse(error, 'en');
    expect(status).toBe(403);
    expect(body.errorCode).toBe('hvl:content-type-not-allowed');
    expect(body.message).toBe(t('h5p.contentTypeNotAllowed', { library: 'H5P.TrueFalse' }, 'en'));
  });

  it('[H5P-006] other Lumi refusals fall back to the message of their status', () => {
    const error = new H5pError('h5p-server:content-missing-view-permission', {}, 403);
    expect(toErrorResponse(error, 'nn').body).toMatchObject({
      errorCode: 'h5p-server:content-missing-view-permission',
      message: t('error.forbidden', {}, 'nn'),
    });
  });

  it('[SEC-005] upload and archive refusals are 400, size limits 413, with their parameters', () => {
    // Act and assert: a file type mismatch, a zip-slip entry and an oversized entry.
    const type = toErrorResponse(
      new RejectedUploadError('upload.file.typeMismatch', { extension: 'png' }),
      'nn',
    );
    expect(type.status).toBe(400);
    expect(type.body.message).toBe(t('upload.file.typeMismatch', { extension: 'png' }, 'nn'));
    const slip = toErrorResponse(new ZipRejectedError('upload.archive.unsafePath', { entry: '../x' }), 'nn');
    expect(slip.status).toBe(400);
    const big = toErrorResponse(
      new ZipRejectedError('upload.archive.fileTooLarge', { entry: 'a', maxMb: 50 }),
      'nn',
    );
    expect(big.status).toBe(413);
  });

  it('[SEC-005] a body-parser size error says how large a request may be', () => {
    const error = Object.assign(new Error('request entity too large'), {
      status: 413,
      limit: 2 * 1024 * 1024,
    });
    expect(toErrorResponse(error, 'en')).toMatchObject({
      status: 413,
      body: { message: t('error.tooLarge', { maxMb: 2 }, 'en') },
    });
  });

  it('[PROD-012] client errors from body parsers, static files and storage guards keep their 4xx status', () => {
    // Act and assert: a body-parser parse error, a missing static file and an unsafe storage name.
    const parse = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      type: 'entity.parse.failed',
    });
    expect(toErrorResponse(parse, 'nn')).toMatchObject({
      status: 400,
      body: { errorCode: 'entity.parse.failed', message: t('error.badRequest', {}, 'nn') },
    });
    const missing = Object.assign(new Error('Not Found'), { statusCode: 404 });
    expect(toErrorResponse(missing, 'en')).toMatchObject({
      status: 404,
      body: { message: t('error.notFound', {}, 'en') },
    });
    expect(toErrorResponse(new UnsafeObjectNameError('../x'), 'nn').status).toBe(400);
  });

  it('[PROD-012] metadata that Lumi’s schema refuses is the author’s error (400), not a server fault', () => {
    const { status, body } = toErrorResponse(new Error('Metadata does not conform to schema.'), 'nn');
    expect(status).toBe(400);
    expect(body).toMatchObject({ errorCode: 'invalid-metadata', message: t('error.badRequest', {}, 'nn') });
  });

  it('[PROD-012] unknown errors and server faults never show their own text', () => {
    // Arrange: errors whose own text would leak hosts, paths or internals.
    const leaks = [
      new Error('ECONNREFUSED 10.0.0.5:5432 /home/app/secret'),
      new H5pError('storage-error', { path: '/var/lib/x' }, 500),
      new HttpError(503, 'error.notFound'),
      'a thrown string',
      undefined,
    ];
    for (const error of leaks) {
      // Act
      const { status, body } = toErrorResponse(error, 'nn');
      // Assert
      expect(status).toBe(500);
      expect(body).toEqual({
        success: false,
        errorCode: 'internal',
        httpStatusCode: 500,
        message: t('error.generic', {}, 'nn'),
      });
    }
  });

  it('[PROD-012] replacements that are not text or numbers are dropped', () => {
    const error = new H5pError(
      'hvl:library-not-installed',
      { library: { toString: () => '<b>x</b>' } } as never,
      400,
    );
    expect(toErrorResponse(error, 'nn').body.message).not.toContain('<b>');
  });
});
