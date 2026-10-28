/**
 * Probe P3 (S5), page-based types: H5P.CoursePresentation and H5P.InteractiveBook save the page the learner was on
 * and each page's child states by position (slide index and element index; chapter index and section index), and
 * the book also saves which chapters and tasks are done (D-093). Played in Chromium.
 *
 * Text-only edits and appended slides resume correctly. The `upstream pin:` tests record that an inserted, moved or
 * removed slide or chapter puts the learner on another page, gives answers or "done" marks to the wrong page, or
 * stops the activity from starting, and that the book crashes even when a chapter or a task is only appended.
 *
 * Spec: PROD-013, H5P-005
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { openStateBench, type StateBench } from './learnerStateAfterEditBench.js';
import * as edits from './learnerStateAfterEditEdits.js';
import type {
  CoursePresentationParams,
  InteractiveBookParams,
  MultiChoiceParams,
} from './learnerStateAfterEditEdits.js';
import { COURSE_PRESENTATION, INTERACTIVE_BOOK } from './learnerStateAfterEditLearners.js';
import { outcomes, probeEdits, type EditProbe, type ResumedView } from './learnerStateAfterEditPlayer.js';

type Slides = CoursePresentationParams['presentation']['slides'];
const copySlide = (slides: Slides, index: number) => {
  const slide = structuredClone(slides[index]!);
  slide.elements = slide.elements.map((e) => ({ ...e, action: e.action && edits.copyOfNode(e.action) }));
  return slide;
};
type BookState = { chapters: { completed: boolean | null; state: { instances: unknown[] } | null }[] };
const chapters = (r: ResumedView) =>
  (r.state as BookState | null)?.chapters.map((c) => [c.completed, c.state?.instances]);

describeWithServices('[PROD-013] learner state in page-based types after an edit (probe P3)', () => {
  describeWithRealPackages('[PROD-013] CoursePresentation and InteractiveBook, resumed in Chromium', () => {
    let bench: StateBench;
    let presentation: EditProbe;
    let book: EditProbe;
    let option: string;
    beforeAll(async () => {
      bench = await openStateBench();
    }, 180_000);
    afterAll(() => bench?.close());

    describeWithBrowser('[PROD-013] in Chromium', (browser) => {
      beforeAll(async () => {
        const cp = await bench.importExample('H5P.CoursePresentation');
        const question = (cp.params as unknown as CoursePresentationParams).presentation.slides[1]!
          .elements[1]!.action!;
        option = edits.plainText((question.params as unknown as MultiChoiceParams).answers[1]!.text);
        const slides = (change: (s: Slides) => void) =>
          edits.edited<CoursePresentationParams>(cp.params, (p) => change(p.presentation.slides));
        presentation = await probeEdits(browser(), bench, cp, COURSE_PRESENTATION, {
          textOnly: slides((s) => {
            const text = s[1]!.elements[0]!.action!.params as { text: string };
            text.text = `${text.text}<p>Tilbakemeldinga kjem medan det framleis er tid til å justere.</p>`;
          }),
          slideAppended: slides((s) => void s.push(copySlide(s, 2))),
          slideInsertedFirst: slides((s) => void s.unshift(copySlide(s, 2))),
          elementsSwapped: slides((s) => edits.swap(s[1]!.elements, 0, 1)),
          savedSlideOnwardRemoved: slides((s) => void s.splice(1)),
          // WHY: last, because dropping the image slide deletes the image file for every later case.
          firstSlideRemoved: slides((s) => void s.shift()),
        });
        const ib = await bench.importExample('H5P.InteractiveBook');
        const bookEdit = (change: (p: InteractiveBookParams) => void) =>
          edits.edited<InteractiveBookParams>(ib.params, change);
        book = await probeEdits(browser(), bench, ib, INTERACTIVE_BOOK, {
          textOnly: bookEdit((p) => {
            const text = p.chapters[0]!.params.content[0]!.content.params as { text: string };
            text.text = edits.replaceText(text.text, 'gjennom heile samlinga', 'gjennom heile emnet');
          }),
          textSectionAppended: bookEdit((p) => {
            const sections = p.chapters[0]!.params.content;
            sections.push({ ...sections[0]!, content: edits.copyOfNode(sections[0]!.content) });
          }),
          taskSectionAppended: bookEdit((p) => {
            const sections = p.chapters[0]!.params.content;
            sections.push({ ...sections[1]!, content: edits.copyOfNode(sections[1]!.content) });
          }),
          chapterAppended: bookEdit((p) => void p.chapters.push(edits.copyOfNode(p.chapters[1]!))),
          chaptersSwapped: bookEdit((p) => edits.swap(p.chapters, 0, 1)),
          firstChapterRemoved: bookEdit((p) => void p.chapters.shift()),
        });
      }, 300_000);

      it('[PROD-013] H5P.CoursePresentation saves the slide and answers by slide and element; text edits and new last slides resume', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        expect(presentation.saved).toEqual({
          ...{ progress: 1, answers: [null, [null, { answers: [1] }]] },
          answered: [null, true, null],
        });
        const onSlide = { started: true, slide: 1, selected: [option], errors: [] };
        expect(
          outcomes(presentation, (r) => ({
            slide: (r.state as { progress?: number } | null)?.progress,
            selected: r.selected,
          })),
        ).toMatchObject({ textOnly: onSlide, slideAppended: onSlide });
      });

      it('upstream pin: H5P.CoursePresentation resumes by index: another slide, a lost answer, or a crash past the last slide', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        expect(
          outcomes(presentation, (r) => ({
            shownSlide: (r.state as { progress?: number } | null)?.progress,
            selected: r.selected,
          })),
        ).toMatchObject({
          // WHY: the learner lands on the slide that now has index 1, and the question's answer went elsewhere.
          slideInsertedFirst: { started: true, shownSlide: 1, selected: [], errors: [] },
          elementsSwapped: { started: true, shownSlide: 1, selected: [], errors: [] },
          // WHY: the saved slide index (1) no longer exists; removing only slides after it would not crash.
          savedSlideOnwardRemoved: {
            started: false,
            errors: ["Cannot read properties of undefined (reading 'hasClass')"],
          },
          firstSlideRemoved: { started: true, shownSlide: 1, selected: [], errors: [] },
        });
      });

      it('[PROD-013] H5P.InteractiveBook saves the page and per chapter: done, tasks done and the chapter’s Column state', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        expect(book.saved).toMatchObject({
          urlFragments: { chapter: expect.stringMatching(/^h5p-interactive-book-chapter-[0-9a-f-]{36}$/) },
          chapters: [
            {
              completed: true,
              sections: [{ taskDone: null }, { taskDone: true }],
              state: { instances: [null, { answers: [1] }] },
            },
            {
              completed: null,
              sections: [{ taskDone: null }, { taskDone: null }],
              state: { instances: [null, ['', '', '']] },
            },
          ],
        });
        expect(outcomes(book, (r) => ({ chapters: chapters(r) }))).toMatchObject({
          textOnly: {
            started: true,
            chapters: [
              [true, [null, { answers: [1] }]],
              [null, [null, ['', '', '']]],
            ],
            errors: [],
          },
          textSectionAppended: { started: true, errors: [] },
        });
      });

      it('upstream pin: H5P.InteractiveBook crashes when a chapter or task is appended and moves "done" marks when chapters move', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        expect(outcomes(book, (r) => ({ chapters: chapters(r) }))).toMatchObject({
          taskSectionAppended: {
            started: false,
            errors: ["Cannot read properties of undefined (reading 'taskDone')"],
          },
          chapterAppended: {
            started: false,
            errors: ["Cannot read properties of undefined (reading 'state')"],
          },
          // WHY: the Blanks chapter, never opened, is now "done"; the question's answer is lost.
          chaptersSwapped: {
            started: true,
            chapters: [
              [true, [null, ['', '', '']]],
              [null, [null, { answers: [] }]],
            ],
            errors: [],
          },
          firstChapterRemoved: { started: true, chapters: [[true, [null, ['', '', '']]]], errors: [] },
        });
        // WHY: the never-opened Blanks chapter also inherits the question chapter's "task done" mark.
        expect((book.resumed.chaptersSwapped?.state as BookState).chapters[0]).toMatchObject({
          completed: true,
          sections: [{ taskDone: null }, { taskDone: true }],
        });
      });
    });
  });
});
