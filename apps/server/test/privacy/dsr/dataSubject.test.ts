/**
 * Unit tests for reading the data subject from standard input (DATA-008, D-108's amendment of 2026-11-04): the Feide ID
 * normalised as at login, Canvas identities taken exactly, at least one identifier, and errors that name a field and
 * never quote a value.
 *
 * Spec: DATA-008, DATA-009
 */
import { describe, expect, it } from 'vitest';
import {
  DataSubjectInputError,
  MAX_LTI_SUBJECTS,
  parseDataSubject,
} from '../../../src/privacy/dsr/dataSubject.js';

const ISS = 'https://canvas.instructure.com';
const SECRET_LOOKING = 'kari.nordmann-1975@hvl.no';

/** The error message of a parse, or undefined when it succeeds. */
const errorOf = (text: string): string | undefined => {
  try {
    parseDataSubject(text);
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(DataSubjectInputError);
    return (error as Error).message;
  }
};

describe('[DATA-008] parseDataSubject', () => {
  it('[DATA-008] normalises the Feide ID as the login does and keeps the issuer and sub exactly', () => {
    // Act
    const subject = parseDataSubject(
      JSON.stringify({ feideId: '  Kari@HVL.no ', lti: [{ issuer: ISS, sub: 'AbC-123' }] }),
    );
    // Assert
    expect(subject).toEqual({ feideId: 'kari@hvl.no', lti: [{ issuer: ISS, subject: 'AbC-123' }] });
  });

  it('[DATA-008] takes a Canvas identity alone, and lists a repeated one once', () => {
    // Act
    const subject = parseDataSubject(
      JSON.stringify({
        lti: [
          { issuer: ISS, sub: 'x' },
          { issuer: ISS, sub: 'x' },
          { issuer: ISS, sub: 'X' },
        ],
      }),
    );
    // Assert
    expect(subject).toEqual({
      lti: [
        { issuer: ISS, subject: 'x' },
        { issuer: ISS, subject: 'X' },
      ],
    });
  });

  it.each([
    ['not JSON', `{"feideId": "${SECRET_LOOKING}"`, 'standard input is not one JSON object'],
    ['a JSON list', `["${SECRET_LOOKING}"]`, 'standard input is not one JSON object'],
    ['an unknown field', `{"${SECRET_LOOKING}": true}`, 'only the fields "feideId" and "lti" are allowed'],
    ['no identifier', '{"lti": []}', 'give a feideId, an lti identity, or both'],
    [
      'a Feide ID without a realm',
      `{"feideId": "kari.nordmann-1975"}`,
      'feideId is not a Feide ID like name@hvl.no',
    ],
    [
      'a sub with spaces',
      `{"lti": [{"issuer": "${ISS}", "sub": " ${SECRET_LOOKING}"}]}`,
      'lti[1].sub must be 1–255 characters without spaces at either end',
    ],
    [
      'an issuer that is no URL',
      `{"lti": [{"issuer": "${SECRET_LOOKING}", "sub": "x"}]}`,
      "lti[1].issuer must be the platform's issuer URL, exactly as Canvas sends it",
    ],
    [
      'an extra field in an identity',
      `{"lti": [{"issuer": "${ISS}", "sub": "x", "name": "${SECRET_LOOKING}"}]}`,
      'lti[1] must be an object with only "issuer" and "sub"',
    ],
  ])('[DATA-008] refuses %s, naming the field and never the value', (_, text, message) => {
    // Act
    const error = errorOf(text);
    // Assert
    expect(error).toBe(message);
    expect(error).not.toContain('kari.nordmann');
  });

  it('[DATA-008] refuses more Canvas identities than one request may name', () => {
    // Arrange
    const lti = Array.from({ length: MAX_LTI_SUBJECTS + 1 }, (_, n) => ({ issuer: ISS, sub: `s${n}` }));
    // Act and assert
    expect(errorOf(JSON.stringify({ lti }))).toBe('lti must be a list of at most 20 Canvas identities');
  });
});
