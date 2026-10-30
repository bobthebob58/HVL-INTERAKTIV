/**
 * Tests for the pedagogisk mappe template loader's structure (D-094 W6a amendment): the markers stand once each,
 * alone, outside sections, with each pair in order; an unclosed comment or front matter is named at its first line;
 * and the Bokmål and English templates match the Nynorsk one. Every problem names the file and the line.
 *
 * Spec: MAPPE-002
 */
import { afterAll, describe, expect, it } from 'vitest';
import { removeMappeFixtureCopies } from '../../support/mappeFixture.js';
import { MIN, templateProblems } from './mappeTemplateBench.js';

afterAll(removeMappeFixtureCopies);

describe('[MAPPE-002] the mappe template’s structure', () => {
  it('[MAPPE-002] needs every marker once, each pair in order, and refuses a marker inside a section', () => {
    // Act
    const missing = templateProblems(MIN.replace('{{referansar}}\n', ''));
    const twice = templateProblems(`${MIN}{{lesarrettleiing}}\n`);
    const reversed = templateProblems(
      MIN.replace('{{del1_start}}', '{{tmp}}')
        .replace('{{del1_slutt}}', '{{del1_start}}')
        .replace('{{tmp}}', '{{del1_slutt}}'),
    );
    const inSection = templateProblems(
      `{{#aktivitetar}}\n{{lesarrettleiing}}\n{{/aktivitetar}}\n${MIN.replace('{{lesarrettleiing}}\n', '')}`,
    );
    // Assert
    expect(missing).toEqual([
      {
        file: 'template.nn.md',
        line: undefined,
        message: expect.stringMatching(/^the marker \{\{referansar\}\} is missing/),
      },
    ]);
    expect(twice).toEqual([
      {
        file: 'template.nn.md',
        line: 10,
        message: 'the marker {{lesarrettleiing}} stands more than once; keep one',
      },
    ]);
    expect(reversed).toEqual([
      {
        file: 'template.nn.md',
        line: 3,
        message: 'the marker {{del1_slutt}} comes before {{del1_start}}; it closes the part',
      },
    ]);
    expect(inSection).toContainEqual({
      file: 'template.nn.md',
      line: 1,
      message:
        'the section {{#aktivitetar}} is not closed before the marker {{lesarrettleiing}}; a marker cannot stand in a section',
    });
  });

  it('[MAPPE-002] reports an unclosed comment and unclosed front matter at the line they start on', () => {
    // Act and assert
    expect(templateProblems(`${MIN}<!-- open\n`)).toEqual([
      {
        file: 'template.nn.md',
        line: 10,
        message: 'the comment `<!--` that starts here is not closed with `-->`',
      },
    ]);
    expect(templateProblems(`---\nid: x\n${MIN}`)).toContainEqual({
      file: 'template.nn.md',
      line: 1,
      message: 'the front matter that starts here is not closed with a line `---`',
    });
  });

  it('[MAPPE-002] keeps nb and en in step with nn: the same values, sections, markers and headings', () => {
    // Arrange
    const nn = `{{dato}}\n{{#aktivitetar}}\n- {{tittel}}\n{{/aktivitetar}}\n${MIN}`;
    // Act
    const problems = templateProblems(
      nn,
      `{{dato}} {{k}}\n{{#aktivitetar}}\n- {{tittel}}\n{{/aktivitetar}}\n${MIN.replace('## Del 1', '### Del 1')}`,
      `\n{{#emneoversikt}}\n- {{emnekode}}\n{{/emneoversikt}}\n${MIN}`,
    );
    // Assert
    // WHY: problems come ordered by file, then line, with the whole-file ones first.
    expect(problems).toEqual([
      { file: 'template.en.md', line: undefined, message: '{{dato}} is in template.nn.md but not here' },
      {
        file: 'template.en.md',
        line: undefined,
        message: '{{tittel}} in {{#aktivitetar}} is in template.nn.md but not here',
      },
      {
        file: 'template.en.md',
        line: 2,
        message: expect.stringMatching(/^sections differ from template\.nn\.md/),
      },
      {
        file: 'template.en.md',
        line: 3,
        message: '{{emnekode}} in {{#emneoversikt}} is here but not in template.nn.md',
      },
      { file: 'template.nb.md', line: 1, message: '{{k}} is here but not in template.nn.md' },
      {
        file: 'template.nb.md',
        line: 8,
        message: expect.stringMatching(/^headings differ from template\.nn\.md/),
      },
    ]);
  });
});
