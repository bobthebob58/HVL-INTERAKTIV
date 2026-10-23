/**
 * Tests that authentication, LTI and sharing refusals answer with a fixed status, a stable code and a
 * translated message.
 *
 * Spec: H5P-007, AUTH-003, LTI-003, PROD-004
 */
import { describe, expect, it } from 'vitest';
import { authError, isAuthError } from '../../src/http/authErrors.js';
import { toErrorResponse } from '../../src/http/h5pErrorResponse.js';
import { HttpError } from '../../src/http/HttpError.js';

describe('[H5P-007] authentication refusals', () => {
  it('[H5P-007] a missing or wrong CSRF token or ltik is a 401 with its own code', () => {
    // Act
    const csrf = toErrorResponse(authError('hvl:csrf-invalid'), 'nn');
    const ltik = toErrorResponse(authError('hvl:ltik-invalid'), 'en');
    // Assert
    expect(csrf).toEqual({
      status: 401,
      body: {
        success: false,
        errorCode: 'hvl:csrf-invalid',
        httpStatusCode: 401,
        message: 'Økta di kunne ikkje stadfestast. Last sida på nytt og prøv igjen.',
      },
    });
    expect(ltik.body).toMatchObject({
      errorCode: 'hvl:ltik-invalid',
      message: expect.stringContaining('Canvas'),
    });
  });

  it('[PROD-004] an unavailable activity is one 404, and a draft in Deep Linking a 409', () => {
    expect(toErrorResponse(authError('hvl:activity-unavailable'), 'nb')).toMatchObject({
      status: 404,
      body: { errorCode: 'hvl:activity-unavailable', message: 'Aktiviteten er ikke tilgjengelig.' },
    });
    expect(toErrorResponse(authError('hvl:deep-link-draft'), 'nn').status).toBe(409);
  });

  it('[AUTH-003] keeps the deliberate 503 for a Feide outage but still hides other server faults', () => {
    // Act
    const outage = toErrorResponse(authError('hvl:feide-groups-unavailable'), 'nn');
    const fault = toErrorResponse(new HttpError(503, 'error.feideGroupsUnavailable'), 'nn');
    // Assert
    expect(outage).toMatchObject({ status: 503, body: { errorCode: 'hvl:feide-groups-unavailable' } });
    expect(fault).toMatchObject({ status: 500, body: { errorCode: 'internal' } });
  });

  it('[H5P-007] recognises a refusal by its code only', () => {
    expect(isAuthError(authError('hvl:file-grant-invalid'), 'hvl:file-grant-invalid')).toBe(true);
    expect(isAuthError(authError('hvl:file-grant-invalid'), 'hvl:csrf-invalid')).toBe(false);
    expect(isAuthError(new Error('hvl:csrf-invalid'), 'hvl:csrf-invalid')).toBe(false);
  });

  it('[PROD-012] an HttpError without a code still answers with its message key as the code', () => {
    expect(toErrorResponse(new HttpError(403, 'error.forbidden'), 'nn').body.errorCode).toBe(
      'error.forbidden',
    );
  });
});
