/**
 * Tests for the one-sentence summaries of the Innsikt tab's charts: they name only shown values (never a hidden item
 * or answer), pick the hardest shown question, the commonest shown wrong option or gap answer and the smallest shown
 * video share, and say when nothing can be shown.
 *
 * Spec: INS-008, INS-006, INS-002, INS-003, INS-005
 */
import { describe, expect, it } from 'vitest';
import {
  choiceSummary,
  commonestWrongOption,
  gapSummary,
  itemsSummary,
  videoSummary,
} from '../../../src/features/insight/insightSummaries';
import type { ChoiceMisconception } from '../../../src/features/insight/insightReportShape';
import { HIDDEN, plain, REPORT, shown } from './insightAnswers';
import { VIDEO_REPORT } from './insightOtherAnswers';

const choice = REPORT.misconceptions[0] as ChoiceMisconception;

describe('[INS-008] chart summaries', () => {
  it('[INS-002][INS-006] names the first question with a shown share, skipping hidden ones', () => {
    // Arrange
    const items = [{ ...REPORT.items[2]! }, ...REPORT.items.slice(0, 2)];
    // Act
    const summary = plain(itemsSummary(items, 5, 'nn'));
    // Assert
    expect(summary).toBe(
      'Av spørsmåla der delen riktige kan visast, er spørsmål 2 vanskelegast, «Kva gjer mitokondriane?»: 40 % riktig på første forsøk og 65 % på siste.',
    );
    expect(itemsSummary([REPORT.items[2]!], 5, 'nn')).toBe(
      'Ingen spørsmål har svar frå nok studentar til at delen riktige kan visast.',
    );
  });

  it('[INS-003][INS-006] the commonest wrong option is among the shown counts, never a right or hidden one', () => {
    // Arrange
    const options = [
      { index: 0, text: 'Rett', correct: true, feedback: null, learners: shown(30) },
      { index: 1, text: 'Skjult', correct: false, feedback: 'f1', learners: HIDDEN },
      { index: 2, text: 'Feil', correct: false, feedback: 'f2', learners: shown(6) },
    ];
    // Act
    const wrong = commonestWrongOption({ ...choice, options });
    // Assert
    expect(wrong).toEqual({ text: 'Feil', count: 6, feedback: 'f2' });
    expect(choiceSummary({ ...choice, options }, 'en')).toBe(
      'Most common wrong answer of those that can be shown: “Feil”, chosen by 6 students.',
    );
  });

  it('[INS-003] a gap’s summary names its commonest listed wrong answer, or says none can be shown', () => {
    // Arrange
    const gap = {
      index: 1,
      correctAnswers: ['x'],
      correct: shown(9),
      wrongAnswers: [],
      otherWrong: HIDDEN,
      empty: shown(0),
    };
    // Act and assert
    expect(gapSummary(gap, 'nb')).toBe(
      'Luke 2: ingen feil svar er gitt av nok studenter til at de kan vises.',
    );
    expect(gapSummary({ ...gap, wrongAnswers: [{ answer: 'y', learners: shown(5) }] }, 'nb')).toBe(
      'Luke 2: vanligste feilsvar av dem som kan vises, er «y» (5 studenter).',
    );
  });

  it('[INS-005] names the video task with the smallest shown share, or says none can be shown', () => {
    // Act and assert
    expect(plain(videoSummary(VIDEO_REPORT.videoEngagement ?? [], 'nn'))).toBe(
      'Av oppgåvene der delen kan visast, svarte minst del på «Skriv namnet.» (5:10): 40 %.',
    );
    expect(videoSummary([], 'nn')).toBe('Ingen oppgåve har svar frå nok studentar til at delen kan visast.');
  });

  it('[INS-005][INS-006] never names a task whose share is hidden, even when it comes first', () => {
    // Arrange
    const [first, second] = VIDEO_REPORT.videoEngagement ?? [];
    const hiddenFirst = { ...first!, label: 'Skjult', answered: HIDDEN, share: HIDDEN };
    // Act and assert
    expect(plain(videoSummary([hiddenFirst, second!], 'nn'))).toBe(
      'Av oppgåvene der delen kan visast, svarte minst del på «Skriv namnet.» (5:10): 40 %.',
    );
    expect(videoSummary([hiddenFirst], 'nn')).toBe(
      'Ingen oppgåve har svar frå nok studentar til at delen kan visast.',
    );
  });

  it.each([
    ['nn', 'kan visast'],
    ['nb', 'kan vises'],
    ['en', 'can be shown'],
  ] as const)(
    '[INS-008][INS-006] in %s, every summary that names a value says it chose among those that can be shown',
    (locale, qualifier) => {
      // Arrange: a hidden cell could hold the true hardest item or commonest answer (D-106's amendment)
      const gap = { index: 0, correctAnswers: ['x'], correct: shown(9), otherWrong: HIDDEN, empty: shown(0) };
      const listed = { ...gap, wrongAnswers: [{ answer: 'y', learners: shown(5) }] };
      // Act
      const summaries = [
        itemsSummary(REPORT.items, 5, locale),
        choiceSummary(choice, locale),
        gapSummary(listed, locale),
        videoSummary(VIDEO_REPORT.videoEngagement ?? [], locale),
      ].map(plain);
      // Assert
      for (const summary of summaries) expect(summary).toContain(qualifier);
    },
  );
});
