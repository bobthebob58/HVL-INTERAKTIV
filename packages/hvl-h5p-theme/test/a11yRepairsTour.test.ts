/**
 * Tests for the one repair that changes focus order (D-080 amendment, src/a11yEditorRepairs.js): while
 * BranchingScenario's editor tour fades a part of the editor (`.tour-fade`), the part is inert, and it is given
 * back when the fade ends; a part H5P made inert itself is left alone.
 *
 * Spec: UD-030, UD-004
 */
import { describe, expect, it } from 'vitest';
import { openRepairDocument, repairScript } from './support/repairDocument.js';

const SCRIPT = repairScript('a11yEditorRepairs.js');

/** BranchingScenario's editor: a faded tree, the tour dialog outside it, and a part H5P made inert on its own. */
const EDITOR = `<div class="editor"><div class="tree tour-fade" id="tree"><button>Legg til</button></div>
  <div class="reuse-container-buttons" id="reuse"><button>Kopier</button></div>
  <div class="joyride-tooltip" id="tour" role="dialog"><button>Neste</button></div>
  <div class="dialog-background" id="own" inert></div></div>`;

function openDocument() {
  const { document, settle } = openRepairDocument(SCRIPT, EDITOR);
  const inert = (id: string) => document.getElementById(id)!.hasAttribute('inert');
  return { document, settle, inert };
}

describe("[UD-030] BranchingScenario's guided tour", () => {
  it('[UD-030][UD-004] a part the tour fades is inert, the tour dialog is not', () => {
    const { inert } = openDocument();
    expect([inert('tree'), inert('reuse'), inert('tour')]).toEqual([true, false, false]);
  });

  it('[UD-030] follows the fade as the tour moves on and gives the part back when it ends', async () => {
    // Arrange
    const { document, settle, inert } = openDocument();
    // Act: the next step fades the reuse panel, and the tree comes back
    document.getElementById('reuse')!.classList.add('tour-fade');
    document.getElementById('tree')!.classList.remove('tour-fade');
    await settle();
    // Assert
    expect([inert('tree'), inert('reuse')]).toEqual([false, true]);
    expect(document.getElementById('tree')!.hasAttribute('data-hvl-inert')).toBe(false);
    // Act: the tour ends
    document.getElementById('reuse')!.classList.remove('tour-fade');
    await settle();
    // Assert
    expect(inert('reuse')).toBe(false);
  });

  it('[UD-030] leaves alone a part H5P made inert itself', async () => {
    const { document, settle, inert } = openDocument();
    document.getElementById('tree')!.classList.remove('tour-fade');
    await settle();
    expect(inert('own')).toBe(true);
  });
});
