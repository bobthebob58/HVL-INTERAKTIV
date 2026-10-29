/**
 * Tests for the guide loader (D-082, D-083): the fixture guide loads into three node trees with the references each
 * cites; no guide files is "no guide yet"; a missing language, an unknown citation, a refused construct, a missing
 * or repeated marker and a parity mismatch between nn, nb and en each stop the load, naming the file and the line.
 * The repository's own guide is tested in ./realGuideContent.test.ts.
 *
 * Spec: PED-001, PED-002
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { ContentProblem } from '../../../src/learningDesign/content/contentProblem.js';
import { describeGuideContent, loadGuideContent } from '../../../src/learningDesign/content/guideContent.js';
import {
  editedGuideFixture,
  fixtureGuide,
  loadFixtureGuide,
  removeGuideFixtureCopies,
} from '../../support/guideFixture.js';

const NN = 'laeringsdesign/guide.nn.md';
const NB = 'laeringsdesign/guide.nb.md';
const EN = 'laeringsdesign/guide.en.md';
/** A guide that passes on its own: a heading, a citation and both markers. */
const SMALL = '## A\n\nTekst [@fixture-guide2026].\n\n{{phase-matrix}}\n\n{{pattern-catalogue}}\n';

/** The problems of a fixture copy with edits, each file shortened to its name. */
const problemsOf = (edits: Parameters<typeof editedGuideFixture>[0]) => {
  const loaded = loadFixtureGuide(editedGuideFixture(edits));
  if (loaded.ok) throw new Error('expected the edited guide to be refused');
  return loaded.problems.map((p: ContentProblem) => ({ ...p, file: p.file.split('/').pop() }));
};

afterAll(removeGuideFixtureCopies);

describe('[PED-002] loading the guide', () => {
  it('[PED-002] loads the fixture guide into a node tree per language, with the references in citation order', () => {
    // Act
    const { documents } = fixtureGuide();
    // Assert
    expect(Object.keys(documents ?? {})).toEqual(['nn', 'nb', 'en']);
    expect(documents?.nn.nodes.map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'list',
      'list',
      'box',
      'marker',
      'heading',
      'paragraph',
      'marker',
    ]);
    expect(documents?.en.references.map((reference) => reference.key)).toEqual([
      'fixture-guide2026',
      'fixture-box2026',
    ]);
    expect(documents?.nb.outline.citations.map(({ line }) => line)).toEqual([3, 13, 15]);
    expect(describeGuideContent(fixtureGuide())).toBe('guide in nn, nb and en (2 sections, 3 citations)');
  });

  it('[PED-002] treats a folder without guide files as no guide yet, which the content check says', () => {
    // Act
    const loaded = loadFixtureGuide(editedGuideFixture({ [NN]: null, [NB]: null, [EN]: null }));
    // Assert
    expect(loaded).toEqual({ ok: true, value: {} });
    expect(loaded.ok && describeGuideContent(loaded.value)).toBe('no guide yet');
  });

  it('[PED-001] refuses a guide that is missing a language, naming the missing file', () => {
    expect(problemsOf({ [NB]: null })).toEqual([
      {
        file: 'guide.nb.md',
        message: expect.stringMatching(/^is missing: guide\.nn\.md and guide\.en\.md exist/),
      },
    ]);
  });

  it('[PED-002] refuses a citation of a key references.yaml does not list, once, in the nn file at its line', () => {
    // Arrange
    const unknown = SMALL.replace('fixture-guide2026', 'nobody2020');
    // Act
    const problems = problemsOf({ [NN]: unknown, [NB]: unknown, [EN]: unknown });
    // Assert
    expect(problems).toEqual([
      {
        file: 'guide.nn.md',
        line: 3,
        message: 'cites [@nobody2020], but references.yaml has no reference with that key',
      },
    ]);
  });

  it('[PED-002] refuses a construct the guide cannot hold, naming the file and the line', () => {
    expect(problemsOf({ [EN]: `${SMALL}\n<img src="x.png">\n` })).toEqual([
      { file: 'guide.en.md', line: 9, message: expect.stringMatching(/holds HTML/) },
    ]);
  });

  it('[PED-002] refuses a guide without a marker, or with one twice', () => {
    // Arrange
    const withoutCatalogue = SMALL.replace('{{pattern-catalogue}}', '');
    const twice = `${SMALL}\n{{phase-matrix}}\n`;
    // Act
    const problems = problemsOf({ [NN]: withoutCatalogue, [NB]: twice, [EN]: SMALL });
    // Assert
    expect(problems).toEqual([
      {
        file: 'guide.nb.md',
        line: 9,
        message: expect.stringMatching(/has \{\{phase-matrix\}\} a second time/),
      },
      { file: 'guide.nn.md', message: expect.stringMatching(/^has no \{\{pattern-catalogue\}\} line/) },
    ]);
  });

  it('[PED-002] refuses nb and en guides whose headings, markers or citations differ from nn, at the first difference', () => {
    // Arrange
    const nb = SMALL.replace('## A', '### A');
    const en = '## A\n\nText [@fixture-box2026].\n\n{{pattern-catalogue}}\n\n{{phase-matrix}}\n';
    // Act
    const problems = problemsOf({ [NN]: SMALL, [NB]: nb, [EN]: en });
    // Assert
    expect(problems).toEqual([
      {
        file: 'guide.en.md',
        line: 3,
        message: expect.stringMatching(/^citation 1 is \[@fixture-box2026\] here/),
      },
      {
        file: 'guide.en.md',
        line: 5,
        message: expect.stringMatching(
          /^marker 1 is \{\{pattern-catalogue\}\} here, but \{\{phase-matrix\}\}/,
        ),
      },
      {
        file: 'guide.nb.md',
        line: 1,
        message: expect.stringMatching(/^heading 1 is ### here, but ## in guide\.nn\.md/),
      },
    ]);
  });

  it('[PED-002] skips the citation check when references.yaml failed to load, which reports its own problems', () => {
    // Act
    const loaded = loadGuideContent({
      root: editedGuideFixture({}),
      phases: undefined,
      references: undefined,
    });
    // Assert
    expect(loaded.ok).toBe(true);
    expect(loaded.ok && loaded.value.documents?.nn.references).toEqual([]);
  });
});
