/**
 * Tests for the shape-based walk through H5P parameters (contentWalker, contentPath, contentKinds).
 *
 * Spec: UD-020
 */
import { describe, expect, it } from 'vitest';
import { machineNameOf, mainMachineNameOf } from '../../src/validation/contentKinds.js';
import { comparePaths, isWithin, pathOf } from '../../src/validation/contentPath.js';
import { nodesWithin, walkContent } from '../../src/validation/contentWalker.js';

const sub = (library: string, params: unknown) => ({
  library,
  params,
  subContentId: 'x',
  metadata: { title: 't' },
});

/** A Column holding an InteractiveVideo with a MultiChoice, and a QuestionSet with a TrueFalse. */
const nested = {
  content: [
    {
      content: sub('H5P.InteractiveVideo 1.28', {
        interactiveVideo: {
          assets: {
            interactions: [
              { duration: { from: 5 }, action: sub('H5P.MultiChoice 1.16', { question: 'Q?' }) },
            ],
          },
        },
        l10n: { play: 'Spel av' },
      }),
      useSeparator: 'auto',
    },
    { content: sub('H5P.QuestionSet 1.21', { questions: [sub('H5P.TrueFalse 1.8', { question: 'P?' })] }) },
  ],
};

describe('[UD-020] contentWalker', () => {
  it('[UD-020] finds the activity and every nested sub-content in pre-order, with dot-and-bracket paths', () => {
    // Act
    const nodes = walkContent('H5P.Column 1.18', nested);
    // Assert
    expect(nodes.map((n) => [n.machineName, n.path])).toEqual([
      ['H5P.Column', ''],
      ['H5P.InteractiveVideo', 'content[0].content.params'],
      ['H5P.MultiChoice', 'content[0].content.params.interactiveVideo.assets.interactions[0].action.params'],
      ['H5P.QuestionSet', 'content[1].content.params'],
      ['H5P.TrueFalse', 'content[1].content.params.questions[0].params'],
    ]);
  });

  it('[UD-020] gives each string to the node that owns it and skips interface labels and file references', () => {
    // Arrange
    const params = {
      text: '<p>Hei</p>',
      file: { path: 'images/a.png', mime: 'image/png', copyright: { license: 'U' } },
      UI: { checkAnswer: 'Sjekk' },
      child: sub('H5P.AdvancedText 1.1', { text: '<p>Inni</p>' }),
    };
    // Act
    const [root, child] = walkContent('H5P.Unknown 1.0', params);
    // Assert
    expect(root?.strings.map((s) => [s.path, s.rich.text])).toEqual([['text', 'Hei']]);
    expect(child?.strings.map((s) => [s.path, s.rich.text])).toEqual([['child.params.text', 'Inni']]);
  });

  it('[UD-020] ignores objects whose library is not a library reference', () => {
    const nodes = walkContent('H5P.Column 1.18', { content: [{ library: 'not a library', params: {} }] });
    expect(nodes).toHaveLength(1);
  });

  it('[UD-020] stops at cycles and at nesting deeper than its limit instead of overflowing the stack', () => {
    // Arrange
    const cyclic: Record<string, unknown> = { text: 'a' };
    cyclic.self = cyclic;
    let deep: unknown = 'bottom';
    for (let i = 0; i < 10_000; i += 1) deep = { next: deep };
    // Act
    const strings = walkContent('H5P.X 1.0', { cyclic, deep }).flatMap((n) => n.strings);
    // Assert
    expect(strings.map((s) => s.path)).toEqual(['cyclic.text']);
  });

  it('[UD-020] lists the nodes inside a path, e.g. one InteractiveBook chapter', () => {
    const nodes = walkContent('H5P.Column 1.18', nested);
    expect(nodesWithin(nodes, 'content[1].content.params').map((n) => n.machineName)).toEqual([
      'H5P.QuestionSet',
      'H5P.TrueFalse',
    ]);
  });
});

describe('[UD-020] contentPath and contentKinds', () => {
  it.each([
    [['', 'questions', 2, 'params'], 'questions[2].params'],
    [['content[1].content', 'params', 'alt'], 'content[1].content.params.alt'],
    [['', 'odd key'], '["odd key"]'],
    [['a', 0, 1], 'a[0][1]'],
  ] as const)('[UD-020] joins %j as %s', ([base, ...segments], path) => {
    expect(pathOf(base, ...segments)).toBe(path);
  });

  it('[UD-020] orders list indices as numbers', () => {
    const paths = ['content[10].x', 'content[2].x', 'content', 'a', 'content[2]'];
    expect([...paths].sort(comparePaths)).toEqual([
      'a',
      'content',
      'content[2]',
      'content[2].x',
      'content[10].x',
    ]);
  });

  it.each([
    ['questions[2].params.alt', 'questions[2].params', true],
    ['questions[20].params', 'questions[2]', false],
    ['anything', '', true],
  ])('[UD-020] tells whether %s is within %s: %s', (path, ancestor, within) => {
    expect(isWithin(path, ancestor)).toBe(within);
  });

  it.each([
    ['H5P.MultiChoice 1.16', 'H5P.MultiChoice'],
    ['H5P.InteractiveVideo-1.28', 'H5P.InteractiveVideo'],
    ['H5P.MultiChoice', undefined],
    ['<script>', undefined],
  ])('[UD-020] reads the machine name of %s', (library, machineName) => {
    expect(machineNameOf(library)).toBe(machineName);
  });

  it('[UD-020] accepts a main library without a version, but never sub-content without one', () => {
    // Act
    const nodes = walkContent('H5P.Column', { content: [{ content: { library: 'H5P.Image', params: {} } }] });
    // Assert
    expect(nodes.map((n) => n.machineName)).toEqual(['H5P.Column']);
    expect(mainMachineNameOf('H5P.Column')).toBe('H5P.Column');
    expect(mainMachineNameOf('<b>')).toBeUndefined();
  });
});
