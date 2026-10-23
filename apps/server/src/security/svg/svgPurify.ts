/**
 * svgPurify — step 3 of SVG sanitising: our own DOMPurify pass, stricter than Lumi's, written out as XML.
 *
 * Why: Lumi's sanitiser keeps external `href`s, `data:text/html` links on `<image>`, `@import` and external
 *      `url()` in CSS (pinned in test/security/upstream/lumiSvgSanitizer.test.ts). D-044 needs those gone too. DOMPurify's HTML parser is used
 *      because its XML mode returns nothing for a file with an `<?xml?>` prolog; the result is then written
 *      with XMLSerializer, because browsers read a served SVG with an XML parser (HTML serialisation would
 *      write `&nbsp;`, which XML does not know, and would not fix namespace declarations).
 * Spec: SEC-001
 * Invariants:
 *   - Same profile as Lumi (`USE_PROFILES: { svg: true }`), so this pass never keeps what Lumi removed.
 *   - Hooks apply ./svgRules.ts: forbidden elements, href rules, on* attributes, animations of href, on* or style,
 *     CSS cleaning of `<style>` and of every attribute. A `<style>` keeps exactly one text child.
 *   - Returns the serialised root `<svg>`, or '' when the result is not exactly one SVG root element.
 *   - One DOMPurify instance with its own jsdom window; hooks are installed once, and calls are synchronous.
 * Collaborators: dompurify 3.4, jsdom 26, ./svgRules.ts, ../SvgSanitizer.ts (step 3), ./svgFinalCheck.ts (step 4).
 * Tests: apps/server/test/security/SvgSanitizer.test.ts, apps/server/test/security/SvgSanitizer.bypass.test.ts
 */
import createDOMPurify, { type Config, type WindowLike } from 'dompurify';
import { JSDOM } from 'jsdom';
import {
  ANIMATION_ELEMENTS,
  cleanAttribute,
  FORBIDDEN_ELEMENTS,
  isUnsafeAnimationTarget,
  neutraliseCss,
  SVG_NS,
} from './svgRules.js';

const { window } = new JSDOM('');
const purifier = createDOMPurify(window as unknown as WindowLike);

const CONFIG: Config & { RETURN_DOM_FRAGMENT: true } = {
  USE_PROFILES: { svg: true },
  FORBID_TAGS: [...FORBIDDEN_ELEMENTS],
  ALLOW_DATA_ATTR: false,
  RETURN_DOM_FRAGMENT: true,
};

purifier.addHook('uponSanitizeElement', (node, data) => {
  if (node.nodeType !== window.Node.ELEMENT_NODE) return;
  const element = node as Element;
  // WHY: a prefixed name (svg:script, rdf:RDF) is no SVG element to the HTML parser, so it goes with its
  // content here. Lumi's pass runs first and keeps such content as plain, inert text.
  const prefixed = data.tagName.includes(':');
  if (
    prefixed ||
    (ANIMATION_ELEMENTS.has(data.tagName) && isUnsafeAnimationTarget(element.getAttribute('attributeName')))
  ) {
    element.remove();
    return;
  }
  if (data.tagName === 'style') {
    // SECURITY: the whole text (also text inside child elements) is cleaned and becomes the only child.
    const css = neutraliseCss(element.textContent ?? '');
    if (css === undefined) element.remove();
    else element.textContent = css;
  }
});

purifier.addHook('uponSanitizeAttribute', (node, data) => {
  const kept = cleanAttribute(node.localName.toLowerCase(), data.attrName, data.attrValue);
  if (kept === undefined) data.keepAttr = false;
  else data.attrValue = kept;
});

const isBlankText = (node: Node): boolean =>
  node.nodeType === window.Node.TEXT_NODE && /^\s*$/.test(node.textContent ?? '');

/**
 * Sanitises SVG markup with D-044's rules.
 * @param text - SVG markup (already through the pre-check and Lumi's sanitiser).
 * @returns The sanitised document as XML, starting with `<svg`, or '' when nothing usable is left.
 */
export function purifySvg(text: string): string {
  const fragment = purifier.sanitize(text, CONFIG);
  const nodes = [...fragment.childNodes].filter((node) => !isBlankText(node));
  const root = nodes[0];
  if (nodes.length !== 1 || !(root instanceof window.Element)) return '';
  if (root.namespaceURI !== SVG_NS || root.localName !== 'svg') return '';
  return new window.XMLSerializer().serializeToString(root);
}
