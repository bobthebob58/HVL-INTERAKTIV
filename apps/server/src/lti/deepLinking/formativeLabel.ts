/**
 * formativeLabel — how a graded Deep Linking item names its Canvas assignment and says that its points are
 * formative: «Tittel (formativ)» as the line item's label, or Canvas's keep-the-name extension and a description.
 *
 * Why: LTI-013 (a) labels AGS scores formative with the suffix "(formativ)" on the line-item label. On
 *      `assignment_selection` Canvas uses that label as the assignment name and overwrites the teacher's own
 *      (C:`doc/api/content_item.md:155-165`, canvas-platform-values.md §9), and whether the suffix belongs there is
 *      for HVL and ALU to decide (Q8, open). D-105 makes it a start-up setting, `AGS_LABEL_MODE`, so their answer
 *      changes the setting, not the code.
 * Spec: LTI-013, LTI-005
 * Invariants:
 *   - `suffix` (the default): the label is the title and « (formativ)», the same in every language (D-105). A title
 *     too long for a Canvas assignment name is cut and ends with «…», so the suffix is never lost.
 *   - `preserve`: the label is the title (cut the same way, without the suffix); the item also carries
 *     `https://canvas.instructure.com/lti/preserveExistingAssignmentName: true` and a `text` that says the points
 *     are formative, in the launch's language. Canvas writes a non-empty `text` into the assignment's description
 *     (C:`doc/api/content_item.md:155-165`) *(verify on HVL's Canvas, D-105)*.
 *   - A Canvas assignment name holds 255 characters (C:`app/models/abstract_assignment.rb:717-723`, unless the
 *     account enforces a shorter SIS name length) *(verify)*. Characters are counted as code points, as Canvas
 *     counts them, so a cut never splits a surrogate pair.
 * Collaborators: ./deepLinkItems.ts (builds the items), ./deepLinkRoutes.ts (passes the mode and the description),
 *   ../../config/env.ts (`AGS_LABEL_MODE`).
 * Tests: apps/server/test/lti/deepLinking/formativeLabel.test.ts, apps/server/test/lti/deepLinking/labelMode.int.test.ts
 */

/** The values of `AGS_LABEL_MODE` (D-105). */
export const AGS_LABEL_MODES = ['suffix', 'preserve'] as const;
/** How a graded item says that its points are formative. */
export type AgsLabelMode = (typeof AGS_LABEL_MODES)[number];
/** The spec as written (LTI-013 (a)). */
export const DEFAULT_AGS_LABEL_MODE: AgsLabelMode = 'suffix';

/** The suffix LTI-013 writes, in every language (D-105). */
export const FORMATIVE_SUFFIX = '(formativ)';
/** The longest Canvas assignment name, in characters *(verify)*. */
export const ASSIGNMENT_NAME_MAX = 255;
/** Canvas's content-item extension that keeps the teacher's own assignment name (C:`doc/api/content_item.md`). */
export const PRESERVE_NAME_EXTENSION = 'https://canvas.instructure.com/lti/preserveExistingAssignmentName';

/** How the route asks for graded items to be named. */
export type LineItemLabelling =
  | { readonly mode: 'suffix' }
  | {
      readonly mode: 'preserve';
      /** The formative notice for the item's `text`, in the launch's language. */
      readonly description: string;
    };

/** What a graded item gets: the line item's label and any extra item fields. */
export interface GradedNaming {
  readonly label: string;
  /** Added to the content item itself (not to its line item); empty in `suffix` mode. */
  readonly itemFields: {
    readonly text?: string;
    readonly [PRESERVE_NAME_EXTENSION]?: true;
  };
}

const ELLIPSIS = '…';

/**
 * Cuts a text to a number of characters (code points), ending a cut one with «…».
 * @param text - The text, already trimmed.
 * @param max - The most characters the result may have (at least 1).
 * @returns The text, or its start and «…».
 */
function cutTo(text: string, max: number): string {
  const characters = Array.from(text);
  if (characters.length <= max) return text;
  return `${characters
    .slice(0, max - 1)
    .join('')
    .trimEnd()}${ELLIPSIS}`;
}

/**
 * The `suffix` mode's label: the title and «(formativ)», within Canvas's name length.
 * @param title - The activity's title.
 * @returns e.g. `Brøkar (formativ)`; a long title is cut and ends with «…» before the suffix.
 * @example
 * formativeLabel('Brøkar'); // 'Brøkar (formativ)'
 * @spec LTI-013
 */
export function formativeLabel(title: string): string {
  const room = ASSIGNMENT_NAME_MAX - Array.from(` ${FORMATIVE_SUFFIX}`).length;
  const base = cutTo(title.trim(), room);
  // WHY: the suffix comes last and is never cut, so Canvas's gradebook always shows it (D-105).
  return base === '' ? FORMATIVE_SUFFIX : `${base} ${FORMATIVE_SUFFIX}`;
}

/**
 * Names a graded item as the configured mode says (D-105).
 * @param title - The activity's title.
 * @param labelling - The mode, and in `preserve` mode the description.
 * @returns The line item's label and the extra content-item fields.
 * @spec LTI-013
 */
export function gradedNaming(title: string, labelling: LineItemLabelling): GradedNaming {
  if (labelling.mode === 'suffix') return { label: formativeLabel(title), itemFields: {} };
  // WHY: Canvas keeps the teacher's assignment name, so the formative notice goes into the description instead.
  return {
    label: cutTo(title.trim(), ASSIGNMENT_NAME_MAX),
    itemFields: { text: labelling.description, [PRESERVE_NAME_EXTENSION]: true },
  };
}
