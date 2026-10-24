/**
 * branchingGraph — a BranchingScenario's content as a graph: which nodes are decision points (BranchingQuestion),
 * where each node leads, how many decisions the longest path from the start makes, and whether there is a way back.
 *
 * Why: PED-H06 asks for 2–4 decision points on the main path and a retry path. BranchingScenario addresses nodes
 *      by their index in `branchingScenario.content` (`nextContentId`); a negative or unknown index ends the case.
 * Spec: PED-020
 * Invariants:
 *   - The start is node 0. The "main path" is the path from the start, without repeating a node, that meets the
 *     most decision points.
 *   - Each node's edges are distinct: alternatives that lead to the same node are one edge.
 *   - The best path on from a node on no cycle is computed once and reused (./graphCycles.ts), so the common
 *     layouts (every alternative leads on to the next question, or to its own feedback node and then on) take
 *     linear time; only paths inside a cycle are searched one by one.
 *   - The search is bounded (SEARCH_BUDGET node expansions, MAX_PATH_LENGTH nodes deep); past either bound the
 *     count is `undefined`, never a guess.
 *   - Pure and deterministic: nodes and edges are visited in list order.
 * Collaborators: ./rules/branchingStructureHint.ts, ./contentKinds.ts, ./graphCycles.ts.
 * Tests: apps/server/test/validation/rules/branchingStructureHint.test.ts
 */
import { machineNameOf } from './contentKinds.js';
import { nodesOnCycles } from './graphCycles.js';
import { asArray, asNumber, asString, fieldAt } from './paramReaders.js';

/** A BranchingScenario's content as a graph. */
export interface BranchingGraph {
  /** Per node: whether it is a decision point. */
  readonly decisions: readonly boolean[];
  /** Per node: the distinct nodes it can lead to, in list order (ends left out). */
  readonly edges: readonly (readonly number[])[];
}

// WHY: real scenarios have tens of nodes; the bounds keep a pathological graph from stalling a publish request
// or exhausting the stack.
const SEARCH_BUDGET = 20_000;
const MAX_PATH_LENGTH = 500;

/**
 * Builds the graph of `branchingScenario.content`.
 * @param content - The content list.
 * @returns Decision points and edges, by index.
 */
export function branchingGraphOf(content: readonly unknown[]): BranchingGraph {
  const inRange = (id: number | undefined): id is number =>
    id !== undefined && Number.isInteger(id) && id >= 0 && id < content.length;
  const decisions = content.map(
    (node) => machineNameOf(asString(fieldAt(node, 'type', 'library')) ?? '') === 'H5P.BranchingQuestion',
  );
  const edges = content.map((node, index) => {
    const targets = decisions[index]
      ? asArray(fieldAt(node, 'type', 'params', 'branchingQuestion', 'alternatives')).map((alternative) =>
          asNumber(fieldAt(alternative, 'nextContentId')),
        )
      : [asNumber(fieldAt(node, 'nextContentId'))];
    return [...new Set(targets.filter(inRange))];
  });
  return { decisions, edges };
}

/**
 * Counts the decision points on the main path.
 * @param graph - From `branchingGraphOf`.
 * @returns The most decision points any path from node 0 meets, or `undefined` for an empty graph or when the
 *   search budget runs out.
 */
export function decisionPointsOnMainPath(graph: BranchingGraph): number | undefined {
  if (graph.edges.length === 0) return undefined;
  // WHY: from a node on no cycle, no node already on the path is reachable, so its best continuation is fixed.
  const onCycle = nodesOnCycles(graph.edges);
  const known = new Map<number, number>();
  let steps = 0;
  const onPath = new Set<number>();
  const longest = (node: number): number | undefined => {
    const remembered = known.get(node);
    if (remembered !== undefined) return remembered;
    steps += 1;
    if (steps > SEARCH_BUDGET || onPath.size >= MAX_PATH_LENGTH) return undefined;
    onPath.add(node);
    let best = 0;
    for (const next of graph.edges[node] ?? []) {
      if (onPath.has(next)) continue;
      const below = longest(next);
      if (below === undefined) return undefined;
      best = Math.max(best, below);
    }
    onPath.delete(node);
    const result = best + (graph.decisions[node] ? 1 : 0);
    if (!onCycle[node]) known.set(node, result);
    return result;
  };
  return longest(0);
}

/**
 * Tells whether a learner can come back to a node already visited (a loop reachable from the start).
 * @param graph - From `branchingGraphOf`.
 * @returns True when some path from node 0 returns to a node on it.
 */
export function hasLoopFromStart(graph: BranchingGraph): boolean {
  if (graph.edges.length === 0) return false;
  // WHY: an explicit stack instead of recursion, so a long chain of nodes cannot exhaust the call stack.
  const state = new Map<number, 'open' | 'done'>([[0, 'open']]);
  const stack: { node: number; next: number }[] = [{ node: 0, next: 0 }];
  while (stack.length > 0) {
    const top = stack.at(-1) as { node: number; next: number };
    const target = graph.edges[top.node]?.[top.next];
    top.next += 1;
    if (target === undefined) {
      state.set(top.node, 'done');
      stack.pop();
    } else if (state.get(target) === 'open') return true;
    else if (!state.has(target)) {
      state.set(target, 'open');
      stack.push({ node: target, next: 0 });
    }
  }
  return false;
}
