/**
 * Adversarial SVG payloads beyond the fixture corpus: encodings, case and whitespace tricks, namespace
 * confusion, CDATA, CSS escapes and parser breakouts. Each must come out inert or be refused.
 *
 * Spec: SEC-001
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSvgText } from '../../src/security/SvgSanitizer.js';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';
import { svgProblems } from '../support/svgInertness.js';

const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
const KEEP = '<rect id="keep" width="1" height="1"/>';
const wrap = (inner: string) => `<svg ${NS}>${KEEP}${inner}</svg>`;
const b64 = (text: string) => Buffer.from(text).toString('base64');

/** [what it tries, payload]. */
const PAYLOADS: [string, string][] = [
  ['decimal entities in javascript:', wrap('<a href="&#106;&#97;vascript:alert(1)"><text>x</text></a>')],
  ['tab inside the scheme', wrap('<a xlink:href="jav&#x09;ascript:alert(1)"><text>x</text></a>')],
  ['leading space and mixed case', wrap('<a href=" JaVaScRiPt:alert(1)"><text>x</text></a>')],
  ['HTML5 named entity &colon;', wrap('<a href="javascript&colon;alert(1)"><text>x</text></a>')],
  ['protocol-relative image', wrap('<image xlink:href="//attacker.example/x.png" width="1" height="1"/>')],
  ['relative image path', wrap('<image href="../../other-user/secret.png" width="1" height="1"/>')],
  [
    'SVG as data:image/svg+xml',
    wrap(`<image href="data:image/svg+xml;base64,${b64('<svg onload="alert(1)"/>')}"/>`),
  ],
  [
    'SVG bytes labelled image/png',
    wrap(`<image href="data:image/png;base64,${b64(`<svg ${NS} onload="alert(1)"/>`)}"/>`),
  ],
  ['use pointing at a data: document', wrap(`<use href="data:image/svg+xml;base64,${b64('<svg/>')}#x"/>`)],
  ['CSS escape spelling url', wrap('<style>rect { fill: u\\72l(https://attacker.example/x) }</style>')],
  ['CSS escape spelling @import', wrap('<style>@\\69mport "https://attacker.example/x.css";</style>')],
  ['upper-case URL() and quotes', wrap('<rect style="fill:URL( \'https://attacker.example/x#g\' )"/>')],
  ['url() hidden by a comment', wrap('<style>rect{fill:ur/**/l(https://attacker.example/x)}</style>')],
  [
    'image-set without url()',
    wrap('<style>rect{fill:image-set("https://attacker.example/x.png" 1x)}</style>'),
  ],
  [
    '@font-face src',
    wrap('<style>@font-face{font-family:x;src:url(https://attacker.example/f.woff)}</style>'),
  ],
  ['@import as a string', wrap('<style>@IMPORT "https://attacker.example/x.css";</style>')],
  [
    'presentation attribute url()',
    wrap(
      '<rect fill="url(https://attacker.example/p.svg#g)" filter="url(&quot;https://attacker.example/f&quot;)"/>',
    ),
  ],
  ['CDATA in style', wrap('<style><![CDATA[ @import url(https://attacker.example/x.css); ]]></style>')],
  ['CDATA breaking out of style', wrap('<style><![CDATA[</style><script>alert(1)</script>]]></style>')],
  ['CDATA script', wrap('<script><![CDATA[alert(1)]]></script>')],
  ['title CDATA breakout', wrap('<title><![CDATA[</title><script>alert(1)</script>]]></title>')],
  [
    'XHTML default namespace on a group',
    wrap(
      '<g xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script><iframe src="https://attacker.example"/></g>',
    ),
  ],
  [
    'XHTML namespace on the root',
    `<svg xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script>${KEEP}</svg>`,
  ],
  [
    'html: prefixed script',
    wrap('<html:script xmlns:html="http://www.w3.org/1999/xhtml">alert(1)</html:script>'),
  ],
  [
    'bogus xlink namespace',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://attacker.example/ns">${KEEP}<a xlink:href="#keep"/></svg>`,
  ],
  [
    'XInclude of a local file',
    wrap('<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd" parse="text"/>'),
  ],
  ['HTML breakout through <p>', wrap('<p><style><img src=x onerror=alert(1)></style></p>')],
  ['mXSS attribute with </style>', wrap('<style><a id="</style><img src=1 onerror=alert(1)>"></a></style>')],
  [
    'animate xlink:href with spaces',
    wrap('<a href="#keep"><animate attributeName=" xlink:HREF " values="javascript:alert(1)"/></a>'),
  ],
  ['animate an event handler', wrap('<rect><animate attributeName="onmouseover" to="alert(1)"/></rect>')],
  [
    'animateTransform with onbegin',
    wrap('<rect><animateTransform attributeName="transform" type="rotate" onbegin="alert(1)"/></rect>'),
  ],
  ['upper-case handler', wrap('<rect ONLOAD="alert(1)" oNcLiCk="alert(2)"/>')],
  [
    'handler in a foreign namespace',
    wrap('<rect xmlns:ev="http://www.w3.org/2001/xml-events" ev:onclick="alert(1)"/>'),
  ],
  ['feImage external href', wrap('<filter id="f"><feImage href="https://attacker.example/x.png"/></filter>')],
  [
    'UTF-7 declaration',
    `<?xml version="1.0" encoding="UTF-7"?>${wrap('+ADw-script+AD4-alert(1)+ADw-/script+AD4-')}`,
  ],
  ['unclosed root with handler', `<svg ${NS} onload=alert(1)//`],
  [
    'expression and -moz-binding',
    wrap('<rect style="width:expression(alert(1));-moz-binding:url(x.xml#x)"/>'),
  ],
  ['two hrefs, one bad', wrap('<a href="#keep" xlink:href="javascript:alert(1)"><text>x</text></a>')],
  [
    'xml-stylesheet with data: CSS',
    `<?xml-stylesheet type="text/css" href="data:text/css,rect{fill:url(https://attacker.example)}"?>${wrap('')}`,
  ],
  ['ATTLIST default handler', `<!DOCTYPE svg [<!ATTLIST svg onload CDATA "alert(1)">]>${wrap('')}`],
  [
    'second DOCTYPE after a plain one',
    `<!DOCTYPE svg PUBLIC "a" "b"><!DOCTYPE svg [<!ENTITY a "b">]>${wrap('')}`,
  ],
];

describe('[SEC-001] SvgSanitizer bypass attempts', () => {
  it.each(PAYLOADS)('[SEC-001] neutralises or refuses: %s', async (_what, payload) => {
    const result = await sanitizeSvgText(payload).catch((error: unknown) => error);
    if (result instanceof RejectedUploadError) {
      expect(result.messageKey).toBe('upload.file.svgRejected');
      return;
    }
    expect(typeof result).toBe('string');
    const output = result as string;
    expect(svgProblems(output)).toEqual([]);
    const markup = output.replace(/>[^<]*</g, '><');
    expect(markup).not.toMatch(
      /attacker\.example|javascript|alert|<script|xhtml|xinclude|\/etc\/passwd|on[a-z]+=/i,
    );
  });

  it('[SEC-001] most payloads are cleaned rather than refused: the harmless part survives (at most 8 refusals)', async () => {
    let kept = 0;
    for (const [, payload] of PAYLOADS) {
      const output = await sanitizeSvgText(payload).catch(() => '');
      if (output.includes('<rect id="keep"')) kept += 1;
    }
    expect(kept, 'most payloads are cleaned, not refused').toBeGreaterThanOrEqual(PAYLOADS.length - 8);
  });
});
