/**
 * Tests that the piece-by-piece JSON syntax check answers exactly as `JSON.parse` does (D-143): on listed texts,
 * on generated JSON, on generated JSON with one character changed, and on texts drawn from JSON's own characters,
 * however the text is cut into pieces.
 *
 * Spec: SEC-002
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { JsonSyntax } from '../../../src/security/sniff/jsonSyntax.js';

const parses = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/** The check's answer for a text handed over in pieces of the given lengths (the rest in one piece). */
const accepts = (text: string, cuts: readonly number[] = []): boolean => {
  const syntax = new JsonSyntax();
  let at = 0;
  for (const length of [...cuts, text.length]) {
    if (!syntax.push(text.slice(at, at + length))) return false;
    at += length;
  }
  return syntax.end();
};

// WHY: texts from these characters are often almost JSON, which is where a syntax check can go wrong.
const JSON_CHARACTERS = [...'{}[],:"\\/ \t\n\r\f\v\u00019-+.eEtruefalsnbx', 'å', '\u2028', '\ufeff', '😀'];
const nearJson = fc.array(fc.constantFrom(...JSON_CHARACTERS), { maxLength: 24 }).map((c) => c.join(''));
const cuts = fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 12 });

describe('[SEC-002] the JSON syntax check, piece by piece', () => {
  it('[SEC-002] accepts what JSON.parse accepts', () => {
    // Arrange
    const valid = [
      '0',
      '-0',
      '12',
      '-1.5e+10',
      '1E5',
      '0.0',
      '1e999999',
      '"x"',
      '""',
      '"\\u00e5\\uD83D\\"\\\\\\/\\b\\f\\n\\r\\t"',
      '"\u2028 \u007f å 😀"',
      'true',
      'false',
      'null',
      '[]',
      '{}',
      ' \t\r\n[ ] \n',
      '[1,[2,{"a":[]}],"]",{"}":"{"}]',
      '{"a":1,"a":2,"":null,"__proto__":{}}',
      '{ "k" : [ true , false , null ] }',
      `${'['.repeat(5000)}${']'.repeat(5000)}`,
      `${'{"a":['.repeat(700)}1${']}'.repeat(700)}`,
    ];
    // Act and assert
    for (const text of valid)
      expect([text.slice(0, 40), accepts(text), parses(text)]).toEqual([text.slice(0, 40), true, true]);
  });

  it('[SEC-002] refuses what JSON.parse refuses', () => {
    // Arrange
    const invalid = [
      '',
      ' ',
      '\ufeff1',
      '1 2',
      '01',
      '-',
      '+1',
      '.5',
      '1.',
      '1e',
      '1e+',
      '0x10',
      'NaN',
      'Infinity',
      'tru',
      'True',
      'nul l',
      'undefined',
      "'x'",
      '"x',
      '"\t"',
      '"\\x41"',
      '"\\u12g4"',
      '"\\u123"',
      '[',
      ']',
      '[1,]',
      '[,1]',
      '[1 2]',
      '[1}',
      '{"a":1,}',
      '{"a"}',
      '{"a":}',
      '{a:1}',
      '{1:1}',
      '{"a":1]',
      '{}{}',
      '[]\u00a0',
      '[]\f',
      '// c\n1',
      `${'['.repeat(3000)}${']'.repeat(2999)}`,
    ];
    // Act and assert
    for (const text of invalid)
      expect([text.slice(0, 40), accepts(text), parses(text)]).toEqual([text.slice(0, 40), false, false]);
  });

  it('[SEC-002] answers as JSON.parse does for generated JSON, also with one character changed', () => {
    // Arrange
    const withOneChange = fc
      .tuple(fc.json(), fc.nat(), fc.constantFrom(...JSON_CHARACTERS, ''), fc.boolean())
      .map(([json, at, char, replace]) => {
        const i = json.length === 0 ? 0 : at % (json.length + 1);
        return json.slice(0, i) + char + json.slice(i + (replace ? 1 : 0));
      });
    // Act and assert
    fc.assert(
      fc.property(fc.json(), cuts, (text, pieces) => accepts(text, pieces) && accepts(` ${text}\n`)),
      { numRuns: 1500 },
    );
    fc.assert(
      fc.property(withOneChange, cuts, (text, pieces) => accepts(text, pieces) === parses(text)),
      { numRuns: 4000 },
    );
  });

  it('[SEC-002] answers as JSON.parse does for texts made of JSON’s own characters, however they are cut', () => {
    // Act and assert
    fc.assert(
      fc.property(nearJson, cuts, (text, pieces) => accepts(text, pieces) === parses(text)),
      { numRuns: 6000 },
    );
  });

  it('[SEC-002] follows brackets to any depth, as JSON.parse does', () => {
    // Arrange
    const syntax = new JsonSyntax();
    const open = '[{"a":'.repeat(250_000);
    // Act: three million open brackets in pieces, then all of them closed but one
    for (let i = 0; i < 6; i += 1) expect(syntax.push(open), `piece ${i}`).toBe(true);
    const closedButOne = syntax.push(`1${'}]'.repeat(1_499_999)}}`);
    // Assert
    expect([closedButOne, syntax.end()]).toEqual([true, false]);
    expect([syntax.push(' ] '), syntax.end()]).toEqual([true, true]);
    expect([syntax.push(']'), syntax.end()]).toEqual([false, false]);
  });
});
