/**
 * Tests for the text schemas of `content/`: a text in nn, nb and en names a missing language, refuses another one,
 * and every text is trimmed, never blank, within its limit and free of control characters.
 *
 * Spec: PED-001, PROD-012
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CONTENT_LANGUAGES,
  contentText,
  localisedContentText,
} from '../../../src/learningDesign/content/contentText.js';
import { parseYamlContent } from '../../../src/learningDesign/content/yamlContentFile.js';

const label = localisedContentText({ maxLength: 20 });
const messagesOf = (value: unknown, schema: typeof label | ReturnType<typeof contentText> = label) => {
  const result = schema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

describe('[PED-001] content texts', () => {
  it('[PROD-012] needs exactly the three UI languages, Nynorsk first', () => {
    expect(CONTENT_LANGUAGES).toEqual(['nn', 'nb', 'en']);
  });

  it('[PED-001] trims each language and gives { nn, nb, en }', () => {
    expect(label.parse({ nn: ' Forarbeid ', nb: 'Forarbeid', en: 'Pre-work' })).toEqual({
      nn: 'Forarbeid',
      nb: 'Forarbeid',
      en: 'Pre-work',
    });
  });

  it.each([
    [
      'a missing language',
      { nn: 'a', en: 'c' },
      'nb: the nb text is missing (every text needs nn, nb and en)',
    ],
    ['another language', { nn: 'a', nb: 'b', en: 'c', se: 'd' }, ': Unrecognized key: "se"'],
    ['a blank text', { nn: 'a', nb: '   ', en: 'c' }, 'nb: is empty'],
    ['an empty value', { nn: null, nb: 'b', en: 'c' }, 'nn: is empty'],
    ['a number', { nn: 'a', nb: 'b', en: 12 }, 'en: must be text'],
    ['a text over the limit', { nn: 'a'.repeat(21), nb: 'b', en: 'c' }, 'nn: is longer than 20 characters'],
    ['a line break in a one-line text', { nn: 'a\nb', nb: 'b', en: 'c' }, 'nn: must be one line'],
    ['a control character', { nn: 'a\u0007b', nb: 'b', en: 'c' }, 'nn: holds a control character'],
    [
      'one text for every language',
      'Forarbeid',
      ': must give the text in nn, nb and en, each on its own line below the key',
    ],
  ])('[PED-001] refuses %s, naming the language', (_, value, message) => {
    expect(messagesOf(value)).toContain(message);
  });

  it('[PED-001] lets a text hold line breaks when it is not a one-line text', () => {
    expect(messagesOf('first line\nsecond line', contentText({ maxLength: 100, singleLine: false }))).toEqual(
      [],
    );
  });

  it('[PED-001] places a missing language at its text key, and another language at its own line, in a YAML file', () => {
    // Arrange
    const yaml = 'label:\n  nn: Forarbeid\n  en: Pre-work\n  se: Ovdabargu\n';
    // Act
    const result = parseYamlContent(yaml, z.strictObject({ label }), 'x.yaml');
    // Assert
    expect(result).toEqual({
      ok: false,
      problems: [
        {
          file: 'x.yaml',
          line: 1,
          key: 'label.nb',
          message: 'the nb text is missing (every text needs nn, nb and en)',
        },
        { file: 'x.yaml', line: 4, key: 'label.se', message: 'is not a known key (check the spelling)' },
      ],
    });
  });
});
