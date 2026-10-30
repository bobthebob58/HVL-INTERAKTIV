/**
 * PdfSlots — how many PDF exports one server process makes at once: at most `PDF_MAX_CONCURRENCY` in all, and one per
 * person.
 *
 * Why: every export holds a Chromium page in memory and some CPU (D-096). A fixed number of slots keeps one busy
 *      morning from starving the server, and one slot per person keeps a double click or a script from taking them
 *      all; a request that finds no slot is answered 503 `hvl:pdf-busy` at once instead of waiting in a queue.
 * Spec: MAPPE-004
 * Invariants:
 *   - Never more than `max` slots taken, never two for the same person.
 *   - A release frees exactly its own slot, once; a second call does nothing.
 *   - Per process: several server processes each have their own slots (the limit is per process, D-096).
 *   - PRIVACY: holds the `User.id` of a person only while their export runs.
 * Collaborators: ./PdfRenderer.ts.
 * Tests: apps/server/test/learningDesign/mappe/pdfRenderer.test.ts
 */

/** Frees a slot. */
export type ReleasePdfSlot = () => void;

/** The PDF slots of a process. */
export class PdfSlots {
  private readonly holders = new Set<string>();

  /**
   * @param max - The most exports at once, `PDF_MAX_CONCURRENCY` (1–8).
   */
  constructor(private readonly max: number) {}

  /**
   * Takes a slot for a person.
   * @param userId - Whose export it is.
   * @returns The release function, or undefined when every slot is taken or the person already has one.
   */
  take(userId: string): ReleasePdfSlot | undefined {
    if (this.holders.size >= this.max || this.holders.has(userId)) return undefined;
    this.holders.add(userId);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holders.delete(userId);
    };
  }

  /** How many slots are taken now. */
  get taken(): number {
    return this.holders.size;
  }
}
