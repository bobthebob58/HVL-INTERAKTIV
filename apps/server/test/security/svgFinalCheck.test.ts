/**
 * Tests for the last two layers of SVG sanitising on their own: the shared rules (links, CSS, animations) and
 * the final check, which must refuse anything forbidden even if every earlier layer had missed it.
 *
 * Spec: SEC-001
 */
import { describe, it, expect } from 'vitest';
import { assertSafeSvg } from '../../src/security/svg/svgFinalCheck.js';
import { precheckSvg } from '../../src/security/svg/svgPrecheck.js';
import {
  findCssViolation,
  isAllowedHref,
  isUnsafeAnimationTarget,
  neutraliseCss,
} from '../../src/security/svg/svgRules.js';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"';
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAF0lEQVR4nGP4//8/g3M4hGSAs0AkThkA6EocuTVylqEAAAAASUVORK5CYII=';

const UNSAFE: [string, string][] = [
  ['script', `<svg ${NS}><script>alert(1)</script></svg>`],
  ['foreignObject', `<svg ${NS}><foreignObject/></svg>`],
  ['XHTML group', `<svg ${NS}><g xmlns="http://www.w3.org/1999/xhtml"/></svg>`],
  ['XHTML root', '<svg xmlns="http://www.w3.org/1999/xhtml"/>'],
  ['element in the XLink namespace', `<svg ${NS} ${XLINK}><xlink:g/></svg>`],
  ['no namespace', '<svg/>'],
  ['event handler', `<svg ${NS} onload="alert(1)"/>`],
  ['foreign namespace declaration', `<svg ${NS} xmlns:x="https://attacker.example/ns"/>`],
  ['foreign attribute namespace', `<svg ${NS} xmlns:e="http://www.w3.org/2000/svg" e:x="1"/>`],
  ['external href', `<svg ${NS}><a href="https://attacker.example"/></svg>`],
  ['relative href', `<svg ${NS}><image href="x.png"/></svg>`],
  ['data image with SVG bytes', `<svg ${NS}><image href="data:image/png;base64,PHN2Zz4="/></svg>`],
  ['raster data URL on <a>', `<svg ${NS}><a href="data:image/png;base64,${PNG}"/></svg>`],
  ['@import', `<svg ${NS}><style>@import "x.css";</style></svg>`],
  ['element inside style', `<svg ${NS}><style><g/>rect{}</style></svg>`],
  [
    'external url() in style attribute',
    `<svg ${NS}><rect style="fill:url(https://attacker.example)"/></svg>`,
  ],
  ['CSS escape', `<svg ${NS}><rect fill="u\\72l(x)"/></svg>`],
  ['script URL in any attribute', `<svg ${NS}><rect class="java&#x0A;script:alert(1)"/></svg>`],
  ['set', `<svg ${NS}><set attributeName="fill" to="red"/></svg>`],
  ['animate href', `<svg ${NS}><animate attributeName="xlink:href" values="#a"/></svg>`],
  ['DOCTYPE', `<!DOCTYPE svg><svg ${NS}/>`],
  ['CDATA', `<svg ${NS}><![CDATA[x]]></svg>`],
  ['processing instruction', `<?xml-stylesheet href="x.css"?><svg ${NS}/>`],
  ['not well-formed', `<svg ${NS}><rect></svg>`],
  ['two roots', `<svg ${NS}/><svg ${NS}/>`],
  ['text before the root', `x<svg ${NS}/>`],
  ['empty', ''],
];

describe('[SEC-001] SVG final check and rules', () => {
  it.each(UNSAFE)('[SEC-001] the final check refuses %s', (_what, text) => {
    expect(() => assertSafeSvg(text)).toThrow(RejectedUploadError);
  });

  it('[SEC-001] the final check accepts clean SVG', () => {
    for (const text of [
      `<svg ${NS}/>`,
      `<!-- licence --><svg ${NS} ${XLINK}><a xlink:href="#a"><text>&lt;script&gt;</text></a></svg>`,
      `<svg ${NS}><style>.a{fill:url(#g)} a &gt; b {stroke:none}</style><image href="data:image/png;base64,${PNG}"/></svg>`,
      `<svg ${NS}><animateTransform attributeName="transform" type="rotate" from="0" to="90"/></svg>`,
    ]) {
      expect(() => assertSafeSvg(text), text).not.toThrow();
    }
  });

  it('[SEC-001] links may only point inside the drawing or to a matching raster data URL', () => {
    expect(isAllowedHref('#linearGradient123', 'lineargradient')).toBe(true);
    expect(isAllowedHref(`data:image/png;base64,${PNG}`, 'image')).toBe(true);
    expect(isAllowedHref(`data:image/jpeg;base64,${PNG}`, 'image')).toBe(false);
    expect(isAllowedHref(`data:image/png;base64,${PNG}`, 'a')).toBe(false);
    for (const bad of [
      '',
      '#',
      '# x',
      'x.svg#a',
      '//x/#a',
      'https://x',
      'javascript:alert(1)',
      'data:text/html,x',
    ]) {
      expect(isAllowedHref(bad, 'image'), bad).toBe(false);
    }
  });

  it('[SEC-001] CSS keeps local references and loses imports and external loads', () => {
    expect(neutraliseCss('.a{fill:url(#g)}')).toBe('.a{fill:url(#g)}');
    expect(neutraliseCss('@import url(x.css); .a{fill:red}')).toBe('  .a{fill:red}');
    expect(neutraliseCss('.a{background:url("https://x/y.png")} /* c */')).toBe('.a{background:none}  ');
    expect(neutraliseCss('.a{fill:u\\72l(x)}')).toBeUndefined();
    expect(neutraliseCss('.a{fill:image-set("x.png" 1x)}')).toBeUndefined();
    expect(neutraliseCss('.a{fill:url(x.png}')).toBeUndefined();
    expect(findCssViolation('a{behavior:url(#x)}')).toBe('fetching function');
    expect(findCssViolation('@IMPORT "x.css";')).toBe('import');
    expect(findCssViolation('a{fill:\\75 rl(x)}')).toBe('escape');
    expect(findCssViolation('a{fill:url(/**/https://x)}')).toBe('external url');
    expect(findCssViolation('a{fill:url( #g )}')).toBeUndefined();
  });

  it('[SEC-001] the pre-check strips plain DOCTYPEs and xml-stylesheet instructions', () => {
    const svg = `<svg ${NS}/>`;
    expect(precheckSvg(`<?xml-stylesheet type="text/xsl" href="x.xsl"?>${svg}`)).toBe(svg);
    expect(precheckSvg(`<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "svg11.dtd">${svg}`)).toBe(svg);
    expect(precheckSvg(`<!doctype svg SYSTEM 'a>b.dtd'>${svg}`)).toBe(svg);
    for (const bad of [
      `<!DOCTYPE svg [ ]>${svg}`,
      `${svg}<!ENTITY x "y">`,
      `<!DOCTYPE svg PUBLIC "a" [ ]>${svg}`,
    ]) {
      expect(() => precheckSvg(bad), bad).toThrow(RejectedUploadError);
    }
  });

  it('[SEC-001] animations may not target links, event handlers or style', () => {
    for (const name of ['href', 'xlink:href', ' HREF ', 'onclick', 'onbegin', 'style']) {
      expect(isUnsafeAnimationTarget(name), name).toBe(true);
    }
    for (const name of [null, 'fill', 'opacity', 'transform'])
      expect(isUnsafeAnimationTarget(name)).toBe(false);
  });
});
