/**
 * Tests for content/laeringsdesign/references.yaml: every reference of spec 04 §3's research table is there; bad keys,
 * missing fields and `__proto__` are refused by line and key; unknown citations are reported; a reference's language
 * is English unless it says otherwise, and a malformed language is refused.
 *
 * Spec: PED-001, UD-010
 */
import { describe, expect, it } from 'vitest';
import { STUDIO_CONTENT_ROOT } from '../../../src/learningDesign/content/loadStudioContent.js';
import {
  findReference,
  loadReferencesContent,
  REFERENCE_KEY_PATTERN,
  referencesFileSchema,
  unresolvedCitationProblems,
  type ReferencesContent,
} from '../../../src/learningDesign/content/referencesContent.js';
import { parseYamlContent } from '../../../src/learningDesign/content/yamlContentFile.js';

// Spec 04 §3, research basis for the guide page: one key per reference, first author and year.
const SPEC_04_REFERENCES = {
  mayer2009: 'Mayer',
  guo2014: 'Guo',
  szpunar2013: 'Szpunar',
  roediger2006: 'Roediger',
  brame2016: 'Brame',
  shute2008: 'Shute',
  hattie2007: 'Hattie',
  nicol2006: 'Nicol',
  cepeda2006: 'Cepeda',
  dunlosky2013: 'Dunlosky',
  schon1983: 'Schön',
  vanmanen1991: 'van Manen',
  biggs1996: 'Biggs',
  wiggins2005: 'Wiggins',
  mogelvang2025: 'Møgelvang',
  novak1999: 'Novak',
};

const loaded = (): ReferencesContent => {
  const result = loadReferencesContent(STUDIO_CONTENT_ROOT);
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.value;
};

const problemsOf = (yaml: string) => {
  const result = parseYamlContent(yaml, referencesFileSchema, 'references.yaml');
  return result.ok ? [] : result.problems;
};

describe('[PED-001] references.yaml', () => {
  // WHY: the file may gain references (the guide cites more) and ALU sets `verify: false` once it has checked one,
  // so this checks that the research table is there, not the whole file or its flags.
  it('[PED-001] lists every reference of the research table, each by its first author and year', () => {
    // Act
    const { references } = loaded();
    // Assert
    expect(references.map((reference) => reference.key)).toEqual(
      expect.arrayContaining(Object.keys(SPEC_04_REFERENCES)),
    );
    for (const [key, author] of Object.entries(SPEC_04_REFERENCES)) {
      const reference = findReference({ version: 1, references }, key);
      expect(reference?.text.startsWith(author), key).toBe(true);
      expect(reference?.text, key).toContain(`(${key.replace(/\D/g, '')})`);
      expect(key).toMatch(REFERENCE_KEY_PATTERN);
    }
  });

  it('[PED-001] keeps each reference as one line of plain text', () => {
    for (const { key, text } of loaded().references) {
      expect(text, key).not.toMatch(/[\n*_[\]]/);
    }
  });

  it.each([
    ['a key in capitals', 'references:\n  Guo2014:\n    text: T\n    verify: true', 2, 'references.Guo2014'],
    ['a missing verify flag', 'references:\n  guo2014:\n    text: T', 2, 'references.guo2014.verify'],
    [
      'a repeated key',
      'references:\n  a1:\n    text: T\n    verify: true\n  a1:\n    text: U\n    verify: true',
      5,
      'references.a1',
    ],
    [
      'the key __proto__',
      'references:\n  a1:\n    text: T\n    verify: true\n  __proto__:\n    text: U\n    verify: true',
      5,
      'references.__proto__',
    ],
    [
      'an unknown field',
      'references:\n  a1:\n    text: T\n    verify: true\n    doi: x',
      5,
      'references.a1.doi',
    ],
    [
      'a language that is not a language tag',
      'references:\n  a1:\n    text: T\n    verify: true\n    language: norsk',
      5,
      'references.a1.language',
    ],
  ])('[PED-001] refuses %s, naming the line and the key', (_, body, line, key) => {
    expect(problemsOf(`version: 1\n${body}\n`)).toEqual([expect.objectContaining({ line: line + 1, key })]);
  });

  it('[UD-010] gives each reference its language, English when the file leaves it out', () => {
    // Arrange
    const yaml =
      'version: 1\nreferences:\n  a1:\n    text: T\n    verify: true\n  b2:\n    text: U\n    verify: true\n    language: nb\n';
    // Act
    const result = parseYamlContent(yaml, referencesFileSchema, 'references.yaml');
    // Assert
    expect(result.ok ? result.value.references.map((r) => [r.key, r.language]) : result.problems).toEqual([
      ['a1', 'en'],
      ['b2', 'nb'],
    ]);
  });

  it('[PED-001] refuses a file without references', () => {
    expect(problemsOf('version: 1\nreferences: {}\n')).toEqual([
      expect.objectContaining({ key: 'references', message: 'lists no references' }),
    ]);
  });

  it('[PED-001] reports a citation of a key the file does not list, and stays silent when the file failed', () => {
    // Arrange
    const citations = [
      { key: 'guo2014', line: 3 },
      { key: 'guo2015', line: 7 },
    ];
    // Act
    const problems = unresolvedCitationProblems(loaded(), 'content/laeringsdesign/guide.nn.md', citations);
    // Assert
    expect(problems).toEqual([
      {
        file: 'content/laeringsdesign/guide.nn.md',
        line: 7,
        message: 'cites [@guo2015], but references.yaml has no reference with that key',
      },
    ]);
    expect(unresolvedCitationProblems(undefined, 'x.md', citations)).toEqual([]);
  });
});
