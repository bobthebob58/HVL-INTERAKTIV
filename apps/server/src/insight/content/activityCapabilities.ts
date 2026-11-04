/**
 * activityCapabilities — what an activity can send at all, read from its main library and parameters: whether it
 * sends any statement, whether it can send a root result, and, for an InteractiveVideo, its answerable interactions
 * in playing order.
 *
 * Why: D-115: where a type cannot send a root result, completed, the completion rate and attempts are shown as not
 *      available, never as 0, and ImageHotspots' tab says it sends no learning data. An InteractiveVideo sends a root
 *      result only through a submit screen its author added (Q18). INS-005 shows, per InteractiveVideo interaction,
 *      the share of learners who answered it, so the interactions come from the parameters, also the ones nobody
 *      answered.
 * Spec: INS-001, INS-005
 * Invariants:
 *   - ImageHotspots sends no statement and no root result (probe P1). An InteractiveVideo can send a root result
 *     only when `interactiveVideo.assets.endscreens` lists a submit screen. Every other type can (D-115's table).
 *   - An interaction is listed when its `action` is a question with a `subContentId` (./questionCatalogue.ts
 *     `isQuestion`); its time is `duration.from` in seconds. The summary task (`summary.task`, shown at the end) is
 *     listed last, with no time, when it has at least one statement set.
 *   - The parameters are author data: nothing here throws on a field of the wrong type.
 * Collaborators: ./questionCatalogue.ts, ../../learningDesign/safeEditing/subContentNodes.ts, ../InsightService.ts,
 *   ../aggregate/participation.ts, ../aggregate/videoEngagement.ts.
 * Tests: apps/server/test/insight/questionCatalogue.test.ts
 */
import {
  isSubContentNode,
  libraryKey,
  listOf,
  machineNameOf,
  numberOf,
  objectOf,
} from '../../learningDesign/safeEditing/subContentNodes.js';
import { isQuestion } from './questionCatalogue.js';
import { insightText } from './questionShapes.js';

/** What an activity can send. */
export interface ActivityCapabilities {
  /** False for ImageHotspots, which sends no learning data at all. */
  readonly sendsStatements: boolean;
  /** False when the type cannot send a root result as configured: completed and attempts are then not available. */
  readonly sendsRootResult: boolean;
}

/** One answerable InteractiveVideo interaction. */
export interface VideoInteraction {
  /** The `subContentId` its statements carry. */
  readonly item: string;
  /** The library's machine name. */
  readonly library: string;
  /** The interaction's label in the video, plain, or null. */
  readonly label: string | null;
  /** When it appears, in seconds from the start; null for the summary task at the end. */
  readonly atSeconds: number | null;
}

const videoOf = (params: unknown): Record<string, unknown> => objectOf(objectOf(params).interactiveVideo);

/**
 * What an activity can send.
 * @param mainLibrary - The main library's machine name.
 * @param params - The activity's parameters.
 * @returns Whether it sends statements and a root result.
 * @spec INS-001
 */
export function activityCapabilities(mainLibrary: string, params: unknown): ActivityCapabilities {
  if (mainLibrary === 'H5P.ImageHotspots') return { sendsStatements: false, sendsRootResult: false };
  if (mainLibrary === 'H5P.InteractiveVideo') {
    const endscreens = listOf(objectOf(videoOf(params).assets).endscreens);
    return { sendsStatements: true, sendsRootResult: endscreens.length > 0 };
  }
  return { sendsStatements: true, sendsRootResult: true };
}

/** The interaction of an answerable node, or undefined. */
function interactionOf(
  node: unknown,
  label: string | null,
  atSeconds: number | null,
): VideoInteraction | undefined {
  if (!isSubContentNode(node)) return undefined;
  const library = machineNameOf(libraryKey(node.library));
  const item = node.subContentId;
  if (!isQuestion(library, objectOf(node.params)) || typeof item !== 'string' || item === '')
    return undefined;
  return { item, library, label, atSeconds };
}

/**
 * The answerable interactions of an InteractiveVideo, in playing order.
 * @param params - The InteractiveVideo's parameters.
 * @returns The interactions by time (stored order for equal times), then the summary task.
 * @spec INS-005
 */
export function videoInteractions(params: unknown): VideoInteraction[] {
  const video = videoOf(params);
  const timed = listOf(objectOf(video.assets).interactions).flatMap((entry) => {
    const interaction = objectOf(entry);
    const label = insightText(interaction.label);
    const at = numberOf(objectOf(interaction.duration).from) ?? null;
    const found = interactionOf(interaction.action, label === '' ? null : label, at);
    return found ? [found] : [];
  });
  // WHY: Array.prototype.sort is stable, so interactions at the same second keep the author's order.
  const when = (at: number | null): number => at ?? Number.MAX_VALUE;
  timed.sort((a, b) => when(a.atSeconds) - when(b.atSeconds));
  const summary = interactionOf(objectOf(video.summary).task, null, null);
  return summary && !timed.some(({ item }) => item === summary.item) ? [...timed, summary] : timed;
}
