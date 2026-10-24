/**
 * graphCycles — which nodes of a directed graph lie on a cycle (in a strongly connected component of two or more
 * nodes), found with Tarjan's algorithm in linear time.
 *
 * Why: PED-H06 looks for the path through a BranchingScenario that meets the most decision points without
 *      repeating a node. From a node on no cycle, no node visited before it can be reached again, so the best path
 *      on from there does not depend on how the learner got there and can be computed once (../branchingGraph.ts).
 * Spec: PED-020
 * Invariants:
 *   - Pure, deterministic and iterative (an explicit stack), so a long chain cannot exhaust the call stack.
 *   - A self-loop alone does not put a node on a cycle here: a path never repeats a node, so it changes nothing.
 *   - Edges to indices outside the graph are ignored.
 * Collaborators: ./branchingGraph.ts.
 * Tests: apps/server/test/validation/rules/branchingStructureHint.test.ts
 */

/**
 * Marks the nodes that share a strongly connected component with at least one other node.
 * @param edges - Per node, the nodes it leads to.
 * @returns Per node: true when it lies on a cycle through another node.
 */
export function nodesOnCycles(edges: readonly (readonly number[])[]): boolean[] {
  const count = edges.length;
  const index = new Array<number>(count).fill(-1);
  const low = new Array<number>(count).fill(0);
  const onStack = new Array<boolean>(count).fill(false);
  const onCycle = new Array<boolean>(count).fill(false);
  const stack: number[] = [];
  let next = 0;
  const open = (node: number, work: { node: number; edge: number }[]): void => {
    index[node] = next;
    low[node] = next;
    next += 1;
    stack.push(node);
    onStack[node] = true;
    work.push({ node, edge: 0 });
  };
  for (let root = 0; root < count; root += 1) {
    if (index[root] !== -1) continue;
    const work: { node: number; edge: number }[] = [];
    open(root, work);
    while (work.length > 0) {
      const top = work[work.length - 1] as { node: number; edge: number };
      const target = edges[top.node]?.[top.edge];
      top.edge += 1;
      if (target !== undefined) {
        if (target < 0 || target >= count) continue;
        if (index[target] === -1) open(target, work);
        else if (onStack[target]) low[top.node] = Math.min(low[top.node] ?? 0, index[target] ?? 0);
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) low[parent.node] = Math.min(low[parent.node] ?? 0, low[top.node] ?? 0);
      if (low[top.node] !== index[top.node]) continue;
      const members: number[] = [];
      let member: number | undefined;
      do {
        member = stack.pop();
        if (member === undefined) break;
        onStack[member] = false;
        members.push(member);
      } while (member !== top.node);
      if (members.length > 1) for (const m of members) onCycle[m] = true;
    }
  }
  return onCycle;
}
