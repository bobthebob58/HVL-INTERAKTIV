# Test fixtures (apps/server)

Files that tests read as input. Some are **malicious on purpose**. Never copy them into content, and
never serve them outside a test. doc-lint skips this folder in its source checks (DOC-006).

| Folder | What it holds | Used by |
|---|---|---|
| `svg/malicious/` | One SVG per attack that `SEC-001` must neutralise. Examples: an external entity with `standalone="no"`, "billion laughs", inline and namespaced `<script>`, event handlers, `<foreignObject>` with HTML, `javascript:` and `data:text/html` links, external `<image>`/`<use>` references, `@import` in `<style>`, `<set>`/`<animate>` that rewrite `href`, and an `xml-stylesheet` instruction. Each file's comment says what it attacks. | `test/security/SvgSanitizer.test.ts` |
| `svg/benign/` | Ordinary drawings that must survive sanitising and look identical afterwards. Examples: paths and gradients, text, internal `#` references, clip paths and masks, an embedded PNG, and an Inkscape export with a public DOCTYPE. Filters are not in the set: Lumi's SVG-only profile removes them (D-044). | `test/security/SvgSanitizer.test.ts`, `test/security/SvgSanitizer.render.test.ts` |
| `h5p-libraries/` | Tiny H5P libraries with and without `language/nn.json`, used to test the nn → nb → en fallback (`H5P-008`, D-046). | `test/h5p/LanguageFallbackLibraryStorage.test.ts` |
| `content/` | One folder per validator rule (V-*, PED-H*): whole H5P activities in the real parameter shape, `positive-*.json` (the rule fires, with exactly the hits in `expected`) and `negative-*.json` (the rule stays silent); see `content/README.md` (`UD-021`, `PED-020`) | `test/validation/rules/*.test.ts`, `test/validation/contentFixtures.test.ts` |
| `studio-content/` | Content folders laid out like the repository's `content/`: one valid with a renamed phase label, and one per defect the studio content loader must refuse by file, line and key (missing language, unknown key, repeated key, wrong phase key, problems in two files); see `studio-content/README.md` (`PED-001`, D-082) | `test/learningDesign/content/*.test.ts`, `test/support/renamedPhaseLabels.ts` |
| `xapi/` | One JSON file per real content type: the xAPI statements H5P sends in our player for a scripted learner path (load, answer, check or submit; DragText and CoursePresentation also after a reload), recorded by probe P1 in Chromium, with the content ID as `{{contentId}}` and no personal data (H5P's anonymous actor); see `xapi/README.md` (`H5P-009`, `LTI-010`, `DATA-012`, D-102, D-115). The tests rewrite them only with `XAPI_FIXTURES_WRITE=1`. | written and checked by `test/h5p/xapiQuestionTypes.browser.int.test.ts` and `xapiContainerTypes.browser.int.test.ts`; read through `readXapiFixture` in `test/support/xapiFixtures.ts` by step 3's mapper, schema and bridge tests |

The three libraries in `h5p-libraries/` differ only in their language files:

- `H5P.LanguageFixtureNn-1.0` — `nn`, `nb` and `en`: `nn` is served as it is.
- `H5P.LanguageFixture-1.0` — `nb` and `en`, no `nn`: a request for `nn` gets the `nb` file.
- `H5P.LanguageFixtureEn-1.0` — `en` only: a request for `nn` or `nb` gets the `en` file.

Most other S2 tests build their libraries and packages at run time instead: see
`test/support/syntheticLibraries.ts` and the zip builders in `test/support/`.
