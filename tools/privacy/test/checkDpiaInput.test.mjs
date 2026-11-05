/**
 * Tests for the DPIA input's document check (D-113): the real documents agree, and each kind of drift between the
 * DPIA input, the Canvas developer key and the data inventory is named.
 *
 * Spec: DATA-005
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dpiaProblems, readDpiaDocs } from '../checkDpiaInput.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const real = () => readDpiaDocs(ROOT);
const canvasOf = (key) => key.extensions.find((e) => e.platform === 'canvas.instructure.com');

describe('[DATA-005] the DPIA input matches its sources', () => {
  it('[DATA-005] the real DPIA input, developer key and inventory agree', () => {
    // Act
    const problems = dpiaProblems(real());
    // Assert
    expect(problems).toEqual([]);
  });

  it('[DATA-005] a key that releases more than §6 says is caught: a new custom field, a raised level, a new scope', () => {
    // Arrange
    const docs = real();
    const canvas = canvasOf(docs.key);
    canvas.settings.placements[0].custom_fields.email = '$Person.email.primary';
    canvas.privacy_level = 'public';
    docs.key.scopes.push('https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly');
    canvas.custom_fields = { name: '$Person.name.full' };
    // Act
    const problems = dpiaProblems(docs);
    // Assert
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('does not list email = $Person.email.primary'),
        '§6: privacy_level must read `public`, as the developer key has it',
        expect.stringContaining('scope/result.readonly is not named'),
        '§6: the tool-level custom fields differ from the developer key',
      ]),
    );
  });

  it('[DATA-005] a placement on one side only is caught', () => {
    // Arrange
    const docs = real();
    const canvas = canvasOf(docs.key);
    canvas.settings.placements.push({ placement: 'course_navigation', custom_fields: {} });
    canvas.settings.placements = canvas.settings.placements.filter((p) => p.placement !== 'editor_button');
    // Act
    const problems = dpiaProblems(docs);
    // Assert
    expect(problems).toEqual(
      expect.arrayContaining([
        '§6: the placement course_navigation has no row',
        '§6: the placement editor_button is not in the key',
      ]),
    );
  });

  it('[DATA-005] a missing section, a gap in the residuals and a residual cited but not listed are caught', () => {
    // Arrange
    const docs = real();
    docs.dpia = docs.dpia.replace(/^## 9\. /m, '## Nine. ').replace(/^\| R3 \|/m, '| R33a |');
    docs.inventory += '\nSee R999.\n';
    // Act
    const problems = dpiaProblems(docs);
    // Assert
    expect(problems).toEqual(
      expect.arrayContaining([
        'section 9 is missing',
        'DATA-INVENTORY.md cites R999, which §12 does not list',
        expect.stringMatching(/^§12: R4 stands where R3 should/),
      ]),
    );
  });
});
