/**
 * Unit tests of what insight reads from an activity's parameters: the questions at any depth with their plain text,
 * a choice question's options and feedback, the gaps of Blanks and DragText, an InteractiveVideo's interactions, and
 * whether a type can send a root result.
 *
 * Spec: INS-001, INS-002, INS-003, INS-005
 */
import { describe, expect, it } from 'vitest';
import { activityCapabilities, videoInteractions } from '../../src/insight/content/activityCapabilities.js';
import { blanksGaps, dragTextGaps, normaliseGapAnswer } from '../../src/insight/content/gapSolutions.js';
import { questionCatalogue } from '../../src/insight/content/questionCatalogue.js';
import { insightText, questionShape } from '../../src/insight/content/questionShapes.js';
import { INTERACTIVE_VIDEO, IV1, IV2, IV3, Q1, Q2, Q3, QUESTION_SET } from './fixtures/insightActivities.js';

const node = (library: string, subContentId: string | undefined, params: object) => ({
  library,
  subContentId,
  params,
});

describe('[INS-002] the questions of an activity', () => {
  it('[INS-002] finds questions at any depth, in document order, with plain question text', () => {
    // Arrange: an InteractiveBook chapter (Column) holding a QuestionSet, as H5P nests sub-content.
    const book = {
      chapters: [
        node('H5P.Column 1.22', 'chapter-1', {
          content: [
            { content: node('H5P.AdvancedText 1.1', 'text-1', { text: '<p>Les dette.</p>' }) },
            { content: node('H5P.QuestionSet 1.21', 'set-1', QUESTION_SET.params) },
          ],
        }),
      ],
    };
    // Act
    const questions = questionCatalogue('H5P.InteractiveBook', book);
    // Assert
    expect(questions.map(({ item, library, text }) => [item, library, text])).toEqual([
      [Q1, 'H5P.MultiChoice', 'Kva er hovudføremålet med forarbeid?'],
      [Q2, 'H5P.Blanks', 'Fyll inn orda som manglar.'],
      [Q3, 'H5P.DragText', 'Dra orda på rett plass.'],
    ]);
  });

  it('[INS-002] makes a single-question activity its own question, with no item ID', () => {
    const questions = questionCatalogue('H5P.MultiChoice', { question: '<p>Ja &amp; nei?</p>', answers: [] });
    expect(questions).toEqual([
      { item: null, library: 'H5P.MultiChoice', text: 'Ja & nei?', shape: { kind: 'choice', options: [] } },
    ]);
  });

  it('[INS-002] keeps the first node of a duplicated ID and skips nodes without an ID or of other libraries', () => {
    const params = {
      a: node('H5P.TrueFalse 1.8', 'dup', { question: 'Først' }),
      b: node('H5P.TrueFalse 1.8', 'dup', { question: 'Andre' }),
      c: node('H5P.TrueFalse 1.8', undefined, { question: 'Utan ID' }),
      d: node('H5P.Image 1.1', 'image-1', {}),
    };
    expect(questionCatalogue('H5P.Column', params).map(({ item, text }) => [item, text])).toEqual([
      ['dup', 'Først'],
    ]);
  });

  it('[INS-002] never throws on malformed parameters and stops at 100 levels', () => {
    let deep: object = node('H5P.TrueFalse 1.8', 'deepest', { question: 'Djupt' });
    for (let i = 0; i < 150; i += 1) deep = { child: deep };
    expect(questionCatalogue('H5P.Column', deep)).toEqual([]);
    expect(questionCatalogue('H5P.Column', 'not an object')).toEqual([]);
    expect(questionCatalogue('H5P.MultiChoice', { question: 42, answers: 'x' })[0]?.text).toBe('');
  });

  it('[INS-002] cuts a long text to 300 characters with an ellipsis', () => {
    const text = insightText(`<p>${'æ'.repeat(400)}</p>`);
    expect(Array.from(text)).toHaveLength(300);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('[INS-003] options and gaps from the parameters', () => {
  it('[INS-003] reads each option with the teacher’s feedback for wrong options only', () => {
    const shape = questionShape('H5P.MultiChoice', QUESTION_SET.params.questions[0]?.params ?? {});
    expect(
      shape.kind === 'choice' && shape.options.map(({ correct, feedback }) => [correct, feedback]),
    ).toEqual([
      [true, null],
      [false, 'Forarbeid førebur samlinga, det erstattar henne ikkje.'],
      [false, 'Poenga er formative & gir ingen karakter.'],
      [false, null],
    ]);
  });

  it('[INS-003] reads Blanks gaps as H5P.Blanks does: alternatives, tips, tags, and no gap for **', () => {
    const gaps = blanksGaps({
      questions: ['<p>*a/b:tips* og ** og *<strong>c</strong>* og *&amp;d*</p>', 7, '*e'],
    });
    expect(gaps.map(({ answers }) => answers)).toEqual([['a', 'b'], ['c'], ['&d']]);
    expect(questionShape('H5P.Blanks', { questions: [] })).toEqual({
      kind: 'gaps',
      gaps: [],
      caseSensitive: true,
    });
  });

  it('[INS-003] reads DragText drop zones without their tips and feedback', () => {
    const gaps = dragTextGaps({ textField: 'Ei *samling:tips* og *forarbeid\\+Bra\\-Nei* og *ord *' });
    expect(gaps.map(({ answers }) => answers)).toEqual([['samling'], ['forarbeid'], ['ord']]);
    expect(dragTextGaps({ textField: 12 })).toEqual([]);
  });

  it('[INS-003] normalises an answer: trimmed, whitespace collapsed, case-folded unless case-sensitive', () => {
    expect(normaliseGapAnswer('  Ut  Henting ')).toBe('ut henting');
    expect(normaliseGapAnswer(' Ola ', true)).toBe('Ola');
    expect(normaliseGapAnswer('å')).toBe('å');
  });
});

describe('[INS-005] what an activity can send', () => {
  it('[INS-005] lists a video’s answerable interactions in playing order, without texts or an empty summary', () => {
    // Act and assert: stored out of time order, read in playing order; a summary counts once it has statements.
    expect(
      videoInteractions(INTERACTIVE_VIDEO.params).map(({ item, atSeconds, label }) => [
        item,
        atSeconds,
        label,
      ]),
    ).toEqual([
      [IV1, 150, 'Første stopp'],
      [IV2, 300, null],
      [IV3, 450, 'Til slutt'],
    ]);
    const withSummary = structuredClone(INTERACTIVE_VIDEO.params);
    withSummary.interactiveVideo.summary.task.params.summaries = [{ summary: ['Ja', 'Nei'] }] as never[];
    expect(videoInteractions(withSummary).at(-1)).toMatchObject({ item: 'summary-1', atSeconds: null });
  });

  it.each([
    ['H5P.ImageHotspots', {}, { sendsStatements: false, sendsRootResult: false }],
    ['H5P.InteractiveVideo', INTERACTIVE_VIDEO.params, { sendsStatements: true, sendsRootResult: false }],
    [
      'H5P.InteractiveVideo',
      { interactiveVideo: { assets: { endscreens: [{ time: 30 }] } } },
      { sendsStatements: true, sendsRootResult: true },
    ],
    ['H5P.QuestionSet', QUESTION_SET.params, { sendsStatements: true, sendsRootResult: true }],
  ])('[INS-001] %s can send %o', (library, params, expected) => {
    expect(activityCapabilities(library, params)).toEqual(expected);
  });
});
