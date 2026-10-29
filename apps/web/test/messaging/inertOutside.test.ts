/**
 * Tests for making the page inert around the editor frame while its save choice is open: everything outside the
 * frame's line of ancestors is inert, the frame and its ancestors are not, and the undo restores exactly what it
 * changed.
 *
 * Spec: PROD-013, UD-006
 */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { inertOutside } from '../../src/messaging/inertOutside';

/** A page like the activity page: header, main with heading, tab list and the panel holding the frame, footer. */
const page = () => {
  document.body.innerHTML = `
    <header id="header"><a href="/">Heim</a></header>
    <main id="main"><h1 id="title">Celler</h1><div id="tabs" role="tablist"></div>
      <div id="panel"><aside id="notice">Merk</aside><iframe id="editor" title="Rediger"></iframe></div>
    </main>
    <footer id="footer" inert></footer>`;
  return (id: string) => document.getElementById(id) as HTMLElement;
};

describe('[PROD-013] the page around an open save choice', () => {
  it('[UD-006] makes every control outside the editor frame inert, and never the frame or what holds it', () => {
    // Arrange
    const $ = page();
    // Act
    inertOutside($('editor'));
    // Assert
    const inert = (id: string) => $(id).hasAttribute('inert');
    expect(['header', 'title', 'tabs', 'notice', 'footer'].map(inert)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(['editor', 'panel', 'main'].map(inert)).toEqual([false, false, false]);
  });

  it('[UD-006] the undo makes the page reachable again and leaves what was inert before as it was', () => {
    // Arrange
    const $ = page();
    const undo = inertOutside($('editor'));
    // Act
    undo();
    // Assert
    expect(document.querySelectorAll('[inert]')).toHaveLength(1);
    expect($('footer').hasAttribute('inert')).toBe(true);
  });
});
