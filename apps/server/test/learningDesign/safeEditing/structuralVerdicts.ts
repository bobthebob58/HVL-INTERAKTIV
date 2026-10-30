/**
 * structuralVerdicts — applies probe P3's edits to a real package's example and says which ones the structure
 * signature counts as structural.
 *
 * Why: the signature's unit tests on the real types (PROD-013, D-093) should run the same edits that probe P3 played
 *      in Chromium (./learnerStateAfterEdit*.browser.int.test.ts), on the same examples, so a case the probe saw
 *      resume correctly or break is judged here without a browser.
 * Spec: PROD-013
 * Invariants: an edit never changes the example (each works on a deep copy, ./learnerStateAfterEditEdits.ts).
 * Collaborators: ../../support/realPackages.ts, ./learnerStateAfterEditEdits.ts,
 *   ../../../src/learningDesign/safeEditing/structureSignature.ts, ../../../src/learningDesign/safeEditing/structuralChange.ts.
 * Tests: ./structuralChangeRealTypes.test.ts, ./structuralChangeRealContainers.test.ts
 */
import { structuralDifference } from '../../../src/learningDesign/safeEditing/structuralChange.js';
import { structureSignature } from '../../../src/learningDesign/safeEditing/structureSignature.js';
import { packageExamples, type PackageExample } from '../../support/realPackages.js';
import { edited } from './learnerStateAfterEditEdits.js';

/**
 * The example of each real package by machine name.
 * @returns e.g. `H5P.MultiChoice` → its example.
 */
export async function examplesByType(): Promise<ReadonlyMap<string, PackageExample>> {
  const examples = await packageExamples();
  return new Map(examples.map((example) => [example.library.split(' ')[0] ?? '', example]));
}

/**
 * Judges each edit of an example.
 * @param example - The real package's example.
 * @param edits - Case name → an edit of a copy of the parameters, in place.
 * @returns Case name → whether the signature counts the edit as structural.
 * @example
 * expect(verdicts(mc, { textOnly: (p) => void (p.question = '…') })).toEqual({ textOnly: false });
 */
export function verdicts<P>(
  example: PackageExample,
  edits: Readonly<Record<string, (params: P) => void>>,
): Record<string, boolean> {
  const before = structureSignature(example.params, example.library);
  return Object.fromEntries(
    Object.entries(edits).map(([name, edit]) => {
      const after = structureSignature(edited<P>(example.params, edit), example.library);
      return [name, structuralDifference(before, after) !== null];
    }),
  );
}
