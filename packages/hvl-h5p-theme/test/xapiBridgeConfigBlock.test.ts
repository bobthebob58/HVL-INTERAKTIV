/**
 * Tests for where the xAPI bridge reads its configuration from (jsdom): only the page's own block, the inert JSON
 * script in the document's head, starts it; the same ID on a script in the body, on a script of another type or on
 * another element does not (D-140).
 *
 * Spec: LTI-010, H5P-009
 */
import { describe, expect, it } from 'vitest';
import { openBridgeDocument } from './support/bridgeDocument.js';

describe('[LTI-010] the block the bridge reads its configuration from', () => {
  it('[LTI-010] the JSON script in the page’s head starts the bridge', () => {
    expect(openBridgeDocument({ block: 'own' }).listening()).toBe(1);
    expect(openBridgeDocument().listening()).toBe(1);
  });

  it.each(['scriptInBody', 'otherType', 'otherElement'] as const)(
    '[H5P-009] a valid configuration under the same ID is not read when it is %s',
    (block) => {
      // Arrange + Act: the configuration in a place the page never writes it
      const page = openBridgeDocument({ block });
      // Assert: the element is there, and the bridge did not start, as on a page without a configuration
      expect(page.dom.window.document.getElementById('hvl-xapi-bridge')).not.toBeNull();
      expect(page.listening()).toBe(0);
    },
  );
});
