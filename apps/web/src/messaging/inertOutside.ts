/**
 * inertOutside — makes everything on the page `inert` except one element and the elements that hold it, takes focus
 * away from those holders, and undoes exactly that afterwards.
 *
 * Why: the editor's save choice is a native modal dialog inside its frame, and a frame's modal dialog is modal only
 *      inside the frame: the page around it stays live (probe P7, D-093). While the dialog is open, the activity
 *      page's own controls (header, tabs, notices, links) must be out of reach of pointer, keyboard and screen
 *      reader, and the frame itself must stay live, so no ancestor of the frame may become inert. An ancestor that
 *      takes focus (the tab panel's `tabindex="0"`, `main` as the skip link's target) would still let a click
 *      beside the frame take focus out of the dialog, so it holds no `tabindex` while the dialog is open.
 * Spec: PROD-013, UD-006
 * Invariants:
 *   - `keep` and each of its ancestors stay as they are; every sibling of them, up to `<body>`'s children, is inert.
 *   - The undo removes `inert` only where this call set it; an element that was inert already stays inert.
 *   - The undo gives each ancestor back the `tabindex` it had, and only those this call took.
 * Collaborators: ./useEditorSaveChoice.ts, ../components/Dialog.tsx (the same rule for the web app's own dialogs).
 * Tests: apps/web/test/messaging/inertOutside.test.ts
 */

/**
 * Makes every element outside `keep`'s line of ancestors inert, and takes the `tabindex` of those ancestors.
 * @param keep - The element that stays reachable, e.g. the editor frame.
 * @returns The undo, which removes `inert` from the elements this call changed and gives back the `tabindex`es.
 */
export function inertOutside(keep: Element): () => void {
  const changed: Element[] = [];
  const tabIndexes: (readonly [Element, string])[] = [];
  // A11Y: WCAG 2.4.3 and 2.1.2: what the open dialog covers cannot be reached until it closes (UD-006).
  for (let node: Element = keep; node.parentElement && node !== document.body; node = node.parentElement) {
    const holder = node.parentElement;
    for (const sibling of holder.children) {
      if (sibling === node || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      changed.push(sibling);
    }
    const tabIndex = holder.getAttribute('tabindex');
    if (holder !== document.body && tabIndex !== null) {
      // A11Y: WCAG 2.4.3: a click beside the frame must not focus its holder and so leave the dialog.
      tabIndexes.push([holder, tabIndex]);
      holder.removeAttribute('tabindex');
    }
  }
  return () => {
    for (const element of changed) element.removeAttribute('inert');
    for (const [element, tabIndex] of tabIndexes) element.setAttribute('tabindex', tabIndex);
  };
}
