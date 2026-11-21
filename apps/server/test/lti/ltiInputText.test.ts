/**
 * Unit tests of the text an LTI login or launch may carry: which fields and claims are refused, which are let
 * through, and that a refusal names nothing from the input.
 *
 * Spec: LTI-001, PROD-012
 */
import { describe, expect, it } from 'vitest';
import {
  assertLaunchFields,
  assertStorableClaims,
  hasControlCharacter,
  isLookupText,
} from '../../src/lti/ltiInputText.js';

const REFUSED = { errorCode: 'hvl:launch-malformed', status: 400 };
const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
const claims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://canvas.instructure.com',
  sub: 'a6d5c443-1f51-4783-ba1a-7686ffe3b54a',
  [`${LTI}roles`]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
  [`${LTI}resource_link`]: { id: 'link-1', title: 'Brøkar', description: 'Første linje\nAndre linje' },
  ...over,
});

describe('[LTI-001] the text of a login or launch', () => {
  it.each([
    ['plain text', 'https://canvas.instructure.com', false],
    ['Norwegian letters and an emoji', 'Brøkar og blåbær 🫐', false],
    ['a zero character', 'a\u0000b', true],
    ['a line break', 'a\nb', true],
    ['a tab', 'a\tb', true],
    ['the delete character', 'a\u007fb', true],
  ])('[LTI-001] %s: control character %s', (_case, text, expected) => {
    // Act
    const found = hasControlCharacter(text);
    // Assert
    expect(found).toBe(expected);
  });

  it('[LTI-001] only a non-empty identifier without control characters is used to look a row up', () => {
    // Arrange
    const values = ['10000000000001', '', 'a\u0000', 'a\n', 'a\ud83d', 42, undefined, ['a']];
    // Act
    const usable = values.map(isLookupText);
    // Assert
    expect(usable).toEqual([true, false, false, false, false, false, false, false]);
  });

  it('[LTI-001] query and form fields without control characters pass, also repeated ones', () => {
    // Arrange
    const query = { iss: 'https://canvas.instructure.com', client_id: ['1', '2'] };
    const body = { login_hint: 'opaque hint, with spaces', id_token: 'aaa.bbb.ccc' };
    // Act
    const check = () => assertLaunchFields(query, body);
    // Assert
    expect(check).not.toThrow();
  });

  it.each([
    ['a zero character in a query field', { iss: 'https://canvas.example\u0000' }, {}],
    ['a line break in a form field', {}, { login_hint: 'hint\r\n' }],
    ['a zero character in a repeated field', { client_id: ['1', '2\u0000'] }, {}],
    ['a zero character in a nested field', {}, { a: { b: ['\u0000'] } }],
    ['half a surrogate pair in a form field', {}, { state: 'abc\ud83d' }],
  ])('[PROD-012] %s is a 400 that names nothing from the request', (_case, query, body) => {
    // Act
    const check = () => assertLaunchFields(query, body);
    // Assert
    expect(check).toThrow(expect.objectContaining(REFUSED));
    expect(check).not.toThrow(/canvas|hint/);
  });

  it('[LTI-001] claims as a platform sends them pass, with a description on several lines', () => {
    // Act
    const check = () => assertStorableClaims(claims());
    // Assert
    expect(check).not.toThrow();
  });

  it.each([
    ['a zero character in the sub', { sub: 'learner\u0000' }],
    ['a line break in the sub', { sub: 'learner\n' }],
    ['a zero character in a text claim', { [`${LTI}context`]: { id: 'c', title: 'Kurs\u0000' } }],
    ['half a surrogate pair in a text claim', { [`${LTI}context`]: { id: 'c', title: 'Kurs\ud83d' } }],
    ['a zero character in a list', { [`${LTI}roles`]: ['Learner', 'x\u0000'] }],
    ['a zero character in a key', { [`${LTI}context`]: { id: 'c', type: [{ 'k\u0000': 1 }] } }],
  ])('[LTI-001] claims with %s are refused before they are stored', (_case, over) => {
    // Act
    const check = () => assertStorableClaims(claims(over));
    // Assert
    expect(check).toThrow(expect.objectContaining(REFUSED));
  });

  it('[LTI-001] a claim nested ten thousand levels deep is checked without running out of stack', () => {
    // Arrange
    let nested: unknown = 'innerst\u0000';
    for (let level = 0; level < 10_000; level += 1) nested = [nested];
    // Act
    const check = () => assertStorableClaims(claims({ [`${LTI}context`]: { id: 'c', type: nested } }));
    // Assert
    expect(check).toThrow(expect.objectContaining(REFUSED));
  });
});
