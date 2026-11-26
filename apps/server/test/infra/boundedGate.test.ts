/**
 * Tests for the bounded gate: a few pieces of work at once, a short line served in order, a refusal when the line
 * is full, and a place that is freed however the work ends; and the limits insight views use.
 *
 * Spec: NFR-002, INS-001
 */
import { describe, expect, it } from 'vitest';
import { BoundedGate, GateBusyError } from '../../src/infra/BoundedGate.js';
import { INSIGHT_GATE_LIMITS, InsightViewGate } from '../../src/insight/InsightViewGate.js';

/** A build that ends when the test says so, and notes when it started. */
function heldBuild(name: string, started: string[]) {
  let end: (value: string) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const done = new Promise<string>((resolve, reject) => {
    end = resolve;
    fail = reject;
  });
  const build = () => {
    started.push(name);
    return done;
  };
  return { build, end: () => end(name), fail: () => fail(new Error(`${name} failed`)) };
}
/** Lets the promises that are ready run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('[NFR-002] how much work runs at once', () => {
  it('[NFR-002] two pieces of work run at once, and the others wait and are served in the order they came', async () => {
    // Arrange
    const gate = new BoundedGate({ atOnce: 2, waiting: 5 });
    const started: string[] = [];
    const views = ['a', 'b', 'c', 'd'].map((name) => heldBuild(name, started));
    // Act: four views are asked for at the same moment
    const answers = views.map((view) => gate.run(view.build));
    await settle();
    const whileTwoRun = { started: [...started], load: gate.load };
    views[0]?.end();
    await settle();
    const afterOneEnded = { started: [...started], load: gate.load };
    for (const view of views.slice(1)) view.end();
    // Assert
    expect(whileTwoRun).toEqual({ started: ['a', 'b'], load: { working: 2, waiting: 2 } });
    expect(afterOneEnded).toEqual({ started: ['a', 'b', 'c'], load: { working: 2, waiting: 1 } });
    expect(await Promise.all(answers)).toEqual(['a', 'b', 'c', 'd']);
    expect(gate.load).toEqual({ working: 0, waiting: 0 });
  });

  it('[NFR-002] work past the places and the line is refused at once, before it starts', async () => {
    // Arrange: one place, one in line
    const gate = new BoundedGate({ atOnce: 1, waiting: 1 });
    const started: string[] = [];
    const [first, second, third] = ['a', 'b', 'c'].map((name) => heldBuild(name, started));
    const running = [gate.run(first!.build), gate.run(second!.build)];
    // Act
    const refused = await gate.run(third!.build).catch((error: unknown) => error);
    // Assert
    expect(refused).toBeInstanceOf(GateBusyError);
    expect(started).toEqual(['a']);
    first!.end();
    second!.end();
    expect(await Promise.all(running)).toEqual(['a', 'b']);
  });

  it('[NFR-002] a build that fails frees its place for the next in line', async () => {
    // Arrange
    const gate = new BoundedGate({ atOnce: 1, waiting: 1 });
    const started: string[] = [];
    const [first, second] = ['a', 'b'].map((name) => heldBuild(name, started));
    const failing = gate.run(first!.build);
    const waiting = gate.run(second!.build);
    // Act
    first!.fail();
    const failure = await failing.catch((error: Error) => error.message);
    second!.end();
    // Assert
    expect(failure).toBe('a failed');
    expect(await waiting).toBe('b');
    expect(gate.load).toEqual({ working: 0, waiting: 0 });
  });

  it('[INS-001] insight views use a gate of two at once and twenty waiting', () => {
    expect(INSIGHT_GATE_LIMITS).toEqual({ atOnce: 2, waiting: 20 });
    expect(new InsightViewGate().load).toEqual({ working: 0, waiting: 0 });
  });
});
