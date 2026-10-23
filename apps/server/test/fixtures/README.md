# Test fixtures (apps/server)

Files that tests read as input. Some are **malicious on purpose**. Never copy them into content, and
never serve them outside a test. doc-lint skips this folder in its source checks (DOC-006).

| Folder | What it holds | Used by |
|---|---|---|
| `svg/malicious/` | One SVG per attack that `SEC-001` must neutralise. Examples: an external entity with `standalone="no"`, "billion laughs", inline and namespaced `<script>`, event handlers, `<foreignObject>` with HTML, `javascript:` and `data:text/html` links, external `<image>`/`<use>` references, `@import` in `<style>`, `<set>`/`<animate>` that rewrite `href`, and an `xml-stylesheet` instruction. Each file's comment says what it attacks. | `test/security/SvgSanitizer.test.ts` |
| `svg/benign/` | Ordinary drawings that must survive sanitising and look identical afterwards. Examples: paths and gradients, text, internal `#` references, clip paths and masks, an embedded PNG, and an Inkscape export with a public DOCTYPE. Filters are not in the set: Lumi's SVG-only profile removes them (D-044). | `test/security/SvgSanitizer.test.ts`, `test/security/SvgSanitizer.render.test.ts` |
| `h5p-libraries/` | Tiny H5P libraries with and without `language/nn.json`, used to test the nn → nb → en fallback (`H5P-008`, D-046). | `test/h5p/LanguageFallbackLibraryStorage.test.ts` |

Most other S2 tests build their libraries and packages at run time instead: see
`test/support/syntheticLibraries.ts` and the zip builders in `test/support/`.
