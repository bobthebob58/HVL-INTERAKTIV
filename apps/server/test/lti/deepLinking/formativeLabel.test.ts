/**
 * Unit tests for the formative label of graded Deep Linking items in both `AGS_LABEL_MODE`s (D-105): the suffix that
 * is never cut, the cut at Canvas's 255-character assignment name, and the `preserve` mode's extension and
 * description; and that a link placement never gets either.
 *
 * Spec: LTI-013, LTI-005
 */
import { describe, expect, it } from 'vitest';
import { buildDeepLinkItems, type DeepLinkPlacement } from '../../../src/lti/deepLinking/deepLinkItems.js';
import {
  ASSIGNMENT_NAME_MAX,
  formativeLabel,
  gradedNaming,
  PRESERVE_NAME_EXTENSION,
  type LineItemLabelling,
} from '../../../src/lti/deepLinking/formativeLabel.js';

const ACTIVITY = { id: '0192f6a8-7c1e-7a35-9d1f-3b0c8e2a4f11', title: 'Brøkar' };
const SETTINGS = { accept_types: ['ltiResourceLink'], accept_multiple: true };
const DESCRIPTION = 'Poenga frå HVL Interaktiv er formative.';
const PRESERVE: LineItemLabelling = { mode: 'preserve', description: DESCRIPTION };
const codePoints = (text: string) => Array.from(text).length;

const itemFor = (placement: DeepLinkPlacement, labelling?: LineItemLabelling) =>
  buildDeepLinkItems({
    activities: [ACTIVITY],
    placement,
    publicBaseUrl: 'https://interaktiv.hvl.no',
    settings: SETTINGS,
    ...(labelling ? { labelling } : {}),
  })[0];

describe('[LTI-013] the formative label', () => {
  it('[LTI-013] suffix mode (the default) labels the line item «Tittel (formativ)» and adds nothing else', () => {
    // Act
    const item = itemFor('assignment_selection');
    // Assert
    expect(item?.lineItem?.label).toBe('Brøkar (formativ)');
    expect(item).not.toHaveProperty('text');
    expect(item).not.toHaveProperty([PRESERVE_NAME_EXTENSION]);
  });

  it('[LTI-013] the suffix is the same in every language and is never cut from a long title', () => {
    // Arrange
    const long = 'Lang tittel '.repeat(30);
    // Act
    const label = formativeLabel(long);
    // Assert
    expect(label.endsWith('… (formativ)')).toBe(true);
    expect(codePoints(label)).toBeLessThanOrEqual(ASSIGNMENT_NAME_MAX);
    expect(formativeLabel('x'.repeat(ASSIGNMENT_NAME_MAX - 11))).toBe(`${'x'.repeat(244)} (formativ)`);
  });

  it('[LTI-013] a cut counts characters, as Canvas does, and never splits an emoji', () => {
    // Arrange: 300 emoji are 600 UTF-16 units
    const emoji = '🧪'.repeat(300);
    // Act
    const label = formativeLabel(emoji);
    // Assert
    expect(codePoints(label)).toBe(ASSIGNMENT_NAME_MAX);
    expect(label).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('[LTI-013] preserve mode keeps the title, asks Canvas to keep the teacher’s name and describes the points', () => {
    // Act
    const item = itemFor('assignment_selection', PRESERVE);
    // Assert
    expect(item?.lineItem?.label).toBe('Brøkar');
    expect(item?.[PRESERVE_NAME_EXTENSION]).toBe(true);
    expect(item?.text).toBe(DESCRIPTION);
    expect(PRESERVE_NAME_EXTENSION).toBe('https://canvas.instructure.com/lti/preserveExistingAssignmentName');
  });

  it('[LTI-013] preserve mode cuts a long title to Canvas’s name length without a suffix', () => {
    const { label } = gradedNaming('y'.repeat(400), PRESERVE);
    expect(codePoints(label)).toBe(ASSIGNMENT_NAME_MAX);
    expect(label.endsWith('…')).toBe(true);
    expect(label).not.toContain('(formativ)');
  });

  it.each<DeepLinkPlacement>(['link_selection', 'editor_button', 'other'])(
    '[LTI-013] %s creates no gradebook column, so it gets neither the label nor the extension in either mode',
    (placement) => {
      for (const labelling of [undefined, PRESERVE]) {
        const item = itemFor(placement, labelling);
        expect(item).not.toHaveProperty('lineItem');
        expect(item).not.toHaveProperty('text');
        expect(item).not.toHaveProperty([PRESERVE_NAME_EXTENSION]);
      }
    },
  );
});
