/**
 * inertOutside — makes everything on the page `inert` except one element and the elements that hold it, and undoes
 * exactly that afterwards.
 *
 * Why: the editor's save choice is a native modal dialog inside its frame, and a frame's modal dialog is modal only
 *      inside the frame: the page around it stays live (probe P7, D-093). While the dialog is open, the activity
 *      page's own controls (header, tabs, notices, links) must be out of reach of pointer, keyboard and screen
 *      reader, and the frame itself must stay live, so no ancestor of the frame may become inert.
 * Spec: PROD-013, UD-006
 * Invariants:
 *   - `keep` and each of its ancestors stay as they are; every sibling of them, up to `<body>`'s children, is inert.
 *   - The undo removes `inert` only where this call set it; an element that was inert already stays inert.
 * Collaborators: ./useEditorSaveChoice.ts, ../components/Dialog.tsx (the same rule for the web app's own dialogs).
 * Tests: apps/web/test/messaging/inertOutside.test.ts
 */

/**
 * Makes every element outside `keep`'s line of ancestors inert.
 * @param keep - The element that stays reachable, e.g. the editor frame.
 * @returns The undo, which removes `inert` from the elements this call changed.
 */
export function inertOutside(keep: Element): () => void {
  const changed: Element[] = [];
  // A11Y: WCAG 2.4.3 and 2.1.2: what the open dialog covers cannot be reached until it closes (UD-006).
  for (let node: Element = keep; node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      changed.push(sibling);
    }
  }
  return () => {
    for (const element of changed) element.removeAttribute('inert');
  };
}
