/**
 * Probe P3 (S5), types whose state points into the content by number: H5P.DragText (word and zone indices),
 * H5P.BranchingScenario (the path as node indices) and H5P.InteractiveVideo (the video time and each interaction's
 * state by list position) (D-093). Played in Chromium.
 *
 * Text-only edits and appended distractors, nodes or interactions resume correctly. The `upstream pin:` tests record
 * that renumbered words, nodes or interactions resume another word, another place in the scenario or another
 * interaction's answer, and that DragText throws on a removed drop zone.
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
  BranchingScenarioParams,
  DragTextParams,
  InteractiveVideoParams,
  MultiChoiceParams,
} from './learnerStateAfterEditEdits.js';
import { BRANCHING_SCENARIO, DRAG_TEXT, INTERACTIVE_VIDEO } from './learnerStateAfterEditLearners.js';
import { outcomes, probeEdits, type EditProbe, type ResumedView } from './learnerStateAfterEditPlayer.js';

type Nodes = BranchingScenarioParams['branchingScenario']['content'];
const nodeText = (nodes: Nodes, id: number) => {
  const params = nodes[id]!.type.params as { text?: string; branchingQuestion?: { question: string } };
  return edits.plainText(params.text ?? params.branchingQuestion?.question ?? '').slice(0, 60);
};
const pathAndScreen = (nodes: Nodes) => (r: ResumedView) => ({
  path: (r.state as { userPath?: number[] } | null)?.userPath,
  onScreen: nodes.map((_, id) => id).filter((id) => r.shown.includes(nodeText(nodes, id))),
});

describeWithServices('[PROD-013] learner state that points into the content by number (probe P3)', () => {
  describeWithRealPackages('[PROD-013] DragText, BranchingScenario and InteractiveVideo', () => {
    let bench: StateBench;
    let dragText: EditProbe;
    let scenario: EditProbe;
    let video: EditProbe;
    let nodes: Nodes;
    beforeAll(async () => {
      bench = await openStateBench();
    }, 180_000);
    afterAll(() => bench?.close());

    describeWithBrowser('[PROD-013] in Chromium', (browser) => {
      beforeAll(async () => {
        const dt = await bench.importExample('H5P.DragText');
        const text = (change: (p: DragTextParams) => void) => edits.edited<DragTextParams>(dt.params, change);
        dragText = await probeEdits(browser(), bench, dt, DRAG_TEXT, {
          textOnly: text(
            (p) =>
              void (p.textField = edits.replaceText(p.textField, 'handlar om', 'handlar mellom anna om')),
          ),
          distractorAdded: text((p) => void (p.distractors = `${p.distractors} *eksamen*`)),
          zoneAppended: text((p) => void (p.textField = `${p.textField}\nEin ny *setning* til slutt.`)),
          firstLinesSwapped: text((p) => edits.editLines(p, (list) => edits.swap(list, 0, 1))),
          lastZoneRemoved: text((p) => edits.editLines(p, (list) => void list.pop())),
        });
        const bs = await bench.importExample('H5P.BranchingScenario');
        nodes = (bs.params as unknown as BranchingScenarioParams).branchingScenario.content;
        const scenarioEdit = (change: (p: BranchingScenarioParams, list: Nodes) => void) =>
          edits.edited<BranchingScenarioParams>(bs.params, (p) => change(p, p.branchingScenario.content));
        scenario = await probeEdits(browser(), bench, bs, BRANCHING_SCENARIO, {
          textOnly: scenarioEdit((_, list) => {
            const node = list[2]!.type.params as { text: string };
            node.text = node.text.replace('<p>', '<p>Godt val. ');
          }),
          nodeAppended: scenarioEdit((_, list) => {
            list.push({
              ...structuredClone(list[3]!),
              type: edits.copyOfNode(list[3]!.type),
              nextContentId: 4,
            });
            list[2]!.nextContentId = list.length - 1;
          }),
          nodeInsertedFirst: scenarioEdit((p, list) => {
            list.unshift({ ...structuredClone(list[0]!), type: edits.copyOfNode(list[0]!.type) });
            edits.renumberNodes(p, (id) => id + 1);
            list[0]!.nextContentId = 1;
          }),
          currentNodeRemoved: scenarioEdit((p, list) => {
            list.splice(2, 1);
            edits.renumberNodes(p, (id) => (id === 2 ? -1 : id > 2 ? id - 1 : id));
          }),
        });
        const iv = await bench.importExample('H5P.InteractiveVideo');
        const interactions = (
          change: (list: InteractiveVideoParams['interactiveVideo']['assets']['interactions']) => void,
        ) =>
          edits.edited<InteractiveVideoParams>(iv.params, (p) =>
            change(p.interactiveVideo.assets.interactions),
          );
        const earlierCopy = (list: InteractiveVideoParams['interactiveVideo']['assets']['interactions']) => ({
          ...{ ...structuredClone(list[0]!), action: edits.copyOfNode(list[0]!.action) },
          duration: { from: 1, to: 2 },
        });
        video = await probeEdits(browser(), bench, iv, INTERACTIVE_VIDEO, {
          textOnly: interactions((list) => {
            const question = list[0]!.action.params as unknown as MultiChoiceParams;
            question.question = question.question.replace('<p>', '<p>Tenk deg om: ');
          }),
          interactionAppended: interactions((list) => void list.push(earlierCopy(list))),
          interactionPrepended: interactions((list) => void list.unshift(earlierCopy(list))),
          onlyInteractionRemoved: interactions((list) => void list.splice(0)),
        });
      }, 360_000);

      it('[PROD-013] H5P.DragText saves word and zone indices; text edits and new distractors resume the same words', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        // WHY: the list follows H5P's shuffled word order, so only its members are fixed.
        expect(dragText.saved).toEqual(
          expect.arrayContaining([
            { draggable: 1, droppable: 0 },
            { draggable: 4, droppable: 1 },
          ]),
        );
        expect(dragText.saved).toHaveLength(2);
        const placed = { started: true, placed: ['samlinga', 'sluttvurdering', '', ''], errors: [] };
        expect(outcomes(dragText, (r) => ({ placed: r.placed }))).toMatchObject({
          textOnly: placed,
          distractorAdded: placed,
        });
      });

      it('upstream pin: H5P.DragText resumes words by index and throws when a saved index is past the last word', () => {
        expect(outcomes(dragText, (r) => ({ placed: r.placed }))).toMatchObject({
          zoneAppended: { started: true, placed: ['samlinga', 'setning', '', '', ''], errors: [] },
          firstLinesSwapped: {
            started: true,
            placed: ['læringsaktivitetar', 'sluttvurdering', '', ''],
            errors: [],
          },
          lastZoneRemoved: { started: false, placed: [], errors: ['Stored user state is invalid'] },
        });
      });

      it('[PROD-013] H5P.BranchingScenario saves the path as node indices; text edits and new nodes resume on the same node', () => {
        expect(scenario.saved).toMatchObject({
          userPath: [0, 1, 2],
          scoring: { visitedIndex: expect.any(Number) },
        });
        expect(outcomes(scenario, pathAndScreen(nodes))).toMatchObject({
          textOnly: { started: true, path: [0, 1, 2], errors: [] },
          nodeAppended: { started: true, path: [0, 1, 2], onScreen: [2], errors: [] },
        });
      });

      it('upstream pin: H5P.BranchingScenario resumes on whatever node now has the saved index', () => {
        expect(outcomes(scenario, pathAndScreen(nodes))).toMatchObject({
          // WHY: index 2 is now the first question, shown over the old start (old nodes 0 and 1): it is asked again.
          nodeInsertedFirst: { started: true, path: [0, 1, 2], onScreen: [0, 1], errors: [] },
          // WHY: index 2 is now the lecture path (old node 3), which this learner never chose.
          currentNodeRemoved: { started: true, path: [0, 1, 2], onScreen: [3], errors: [] },
        });
      });

      it('[PROD-013] H5P.InteractiveVideo saves the time and each interaction’s state by list position; text edits resume', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        expect(video.saved).toMatchObject({
          progress: expect.any(Number),
          answers: [{ answers: [1] }, { progress: null, answers: [] }],
        });
        expect(
          outcomes(video, (r) => ({ answers: (r.state as { answers?: unknown[] } | null)?.answers })),
        ).toMatchObject({
          textOnly: {
            started: true,
            answers: [{ answers: [1] }, { progress: null, answers: [] }],
            errors: [],
          },
          // WHY: the end summary is pushed after the interactions, so the new one got the summary's (empty) state.
          interactionAppended: {
            started: true,
            answers: [{ answers: [1] }, { answers: [] }, { progress: null, answers: [] }],
            errors: [],
          },
        });
      });

      it('upstream pin: H5P.InteractiveVideo hands an interaction the state of whatever interaction had its position', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        expect(
          outcomes(video, (r) => ({ answers: (r.state as { answers?: unknown[] } | null)?.answers })),
        ).toMatchObject({
          // WHY: the new interaction at 1 s shows the learner's answer; the question they answered is empty.
          interactionPrepended: {
            started: true,
            answers: [{ answers: [1] }, { answers: [] }, { progress: null, answers: [] }],
            errors: [],
          },
          onlyInteractionRemoved: { started: true, answers: [{ progress: null, answers: [] }], errors: [] },
        });
      });
    });
  });
});
