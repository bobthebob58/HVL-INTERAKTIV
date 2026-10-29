/**
 * Unit tests for the structure signature on the real page and path types (H5P.CoursePresentation,
 * H5P.InteractiveBook, H5P.BranchingScenario, H5P.InteractiveVideo), with probe P3's edit cases on the packages' own
 * examples: text-only edits are not structural; new, moved and removed slides, chapters, sections, nodes and
 * interactions are, appends included (an appended book chapter crashes the player, D-093).
 *
 * Spec: PROD-013
 */
import { beforeAll, expect, it } from 'vitest';
import type { PackageExample } from '../../support/realPackages.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import * as edits from './learnerStateAfterEditEdits.js';
import type {
  BranchingScenarioParams,
  CoursePresentationParams,
  InteractiveBookParams,
  InteractiveVideoParams,
  MultiChoiceParams,
} from './learnerStateAfterEditEdits.js';
import { examplesByType, verdicts } from './structuralVerdicts.js';

type Slides = CoursePresentationParams['presentation']['slides'];
type Interactions = InteractiveVideoParams['interactiveVideo']['assets']['interactions'];
type VideoParams = InteractiveVideoParams & { interactiveVideo: { summary: { task: { params: object } } } };

const copySlide = (slides: Slides, index: number) => {
  const slide = structuredClone(slides[index]!);
  slide.elements = slide.elements.map((e) => ({ ...e, action: e.action && edits.copyOfNode(e.action) }));
  return slide;
};
const earlierCopy = (list: Interactions) => ({
  ...{ ...structuredClone(list[0]!), action: edits.copyOfNode(list[0]!.action) },
  duration: { from: 1, to: 2 },
});

describeWithRealPackages('[PROD-013] the structure signature on the real page and path types', () => {
  let examples: ReadonlyMap<string, PackageExample>;
  beforeAll(async () => {
    examples = await examplesByType();
  });
  const example = (machineName: string): PackageExample => {
    const found = examples.get(machineName);
    if (!found) throw new Error(`no real package example of ${machineName}`);
    return found;
  };

  it('[PROD-013] H5P.CoursePresentation: added text keeps state; slides and elements added, moved or removed do not', () => {
    const slides = (change: (s: Slides) => void) => (p: CoursePresentationParams) =>
      change(p.presentation.slides);
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<CoursePresentationParams>(example('H5P.CoursePresentation'), {
        textOnly: slides((s) => {
          const text = s[1]!.elements[0]!.action!.params as { text: string };
          text.text = `${text.text}<p>Tilbakemeldinga kjem medan det framleis er tid til å justere.</p>`;
        }),
        slideAppended: slides((s) => void s.push(copySlide(s, 2))),
        slideInsertedFirst: slides((s) => void s.unshift(copySlide(s, 2))),
        elementsSwapped: slides((s) => edits.swap(s[1]!.elements, 0, 1)),
        goToButtonAdded: slides((s) => void s[2]!.elements.push({})),
        savedSlideOnwardRemoved: slides((s) => void s.splice(1)),
        firstSlideRemoved: slides((s) => void s.shift()),
      }),
    ).toEqual({
      ...{ textOnly: false, slideAppended: true, slideInsertedFirst: true, elementsSwapped: true },
      ...{ goToButtonAdded: true, savedSlideOnwardRemoved: true, firstSlideRemoved: true },
    });
  });

  it('[PROD-013] H5P.InteractiveBook: rewording keeps state; any new, moved or removed section or chapter does not', () => {
    const sections = (p: InteractiveBookParams) => p.chapters[0]!.params.content;
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<InteractiveBookParams>(example('H5P.InteractiveBook'), {
        textOnly: (p) => {
          const text = sections(p)[0]!.content.params as { text: string };
          text.text = edits.replaceText(text.text, 'gjennom heile samlinga', 'gjennom heile emnet');
        },
        textSectionAppended: (p) =>
          void sections(p).push({ ...sections(p)[0]!, content: edits.copyOfNode(sections(p)[0]!.content) }),
        taskSectionAppended: (p) =>
          void sections(p).push({ ...sections(p)[1]!, content: edits.copyOfNode(sections(p)[1]!.content) }),
        chapterAppended: (p) => void p.chapters.push(edits.copyOfNode(p.chapters[1]!)),
        chaptersSwapped: (p) => edits.swap(p.chapters, 0, 1),
        firstChapterRemoved: (p) => void p.chapters.shift(),
      }),
    ).toEqual({
      ...{ textOnly: false, textSectionAppended: true, taskSectionAppended: true },
      ...{ chapterAppended: true, chaptersSwapped: true, firstChapterRemoved: true },
    });
  });

  it('[PROD-013] H5P.BranchingScenario: rewording keeps state; new nodes, renumbered paths and alternatives do not', () => {
    type Nodes = BranchingScenarioParams['branchingScenario']['content'];
    const scenario =
      (change: (p: BranchingScenarioParams, list: Nodes) => void) => (p: BranchingScenarioParams) =>
        change(p, p.branchingScenario.content);
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<BranchingScenarioParams>(example('H5P.BranchingScenario'), {
        textOnly: scenario((_, list) => {
          const node = list[2]!.type.params as { text: string };
          node.text = node.text.replace('<p>', '<p>Godt val. ');
        }),
        nodeAppended: scenario((_, list) => {
          list.push({
            ...structuredClone(list[3]!),
            type: edits.copyOfNode(list[3]!.type),
            nextContentId: 4,
          });
          list[2]!.nextContentId = list.length - 1;
        }),
        nodeInsertedFirst: scenario((p, list) => {
          list.unshift({ ...structuredClone(list[0]!), type: edits.copyOfNode(list[0]!.type) });
          edits.renumberNodes(p, (id) => id + 1);
          list[0]!.nextContentId = 1;
        }),
        currentNodeRemoved: scenario((p, list) => {
          list.splice(2, 1);
          edits.renumberNodes(p, (id) => (id === 2 ? -1 : id > 2 ? id - 1 : id));
        }),
        alternativeRedirected: scenario((_, list) => {
          const question = list[1]!.type.params as {
            branchingQuestion: { alternatives: { nextContentId: number }[] };
          };
          question.branchingQuestion.alternatives[1]!.nextContentId = 2;
        }),
      }),
    ).toEqual({
      ...{ textOnly: false, nodeAppended: true, nodeInsertedFirst: true },
      ...{ currentNodeRemoved: true, alternativeRedirected: true },
    });
  });

  it('[PROD-013] H5P.InteractiveVideo: rewording and retiming keep state; the order and the end summary do not', () => {
    const list = (change: (l: Interactions) => void) => (p: VideoParams) =>
      change(p.interactiveVideo.assets.interactions);
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<VideoParams>(example('H5P.InteractiveVideo'), {
        textOnly: list((l) => {
          const question = l[0]!.action.params as unknown as MultiChoiceParams;
          question.question = question.question.replace('<p>', '<p>Tenk deg om: ');
        }),
        retimed: list((l) => void (l[0]!.duration = { from: 2, to: 4 })),
        // WHY: the new interaction takes the position the end summary's state had (probe P3).
        interactionAppended: list((l) => void l.push(earlierCopy(l))),
        interactionPrepended: list((l) => void l.unshift(earlierCopy(l))),
        onlyInteractionRemoved: list((l) => void l.splice(0)),
        summaryEmptied: (p) => void (p.interactiveVideo.summary.task.params = { summaries: [] }),
      }),
    ).toEqual({
      ...{ textOnly: false, retimed: false, interactionAppended: true },
      ...{ interactionPrepended: true, onlyInteractionRemoved: true, summaryEmptied: true },
    });
  });
});
