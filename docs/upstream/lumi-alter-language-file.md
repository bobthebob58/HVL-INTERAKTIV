# Draft: Lumi issue, `alterLibraryLanguageFile` drops every key but `semantics`

| | |
|---|---|
| **Recipient** | Lumi's maintainers, repository `Lumieducation/H5P-Nodejs-library` |
| **Channel** | A public GitHub issue |
| **Status** | Ready |
| **Our records** | D-111 (the HVL language overlay), D-112 |
| **Checked** | 2026-11-05: 10.0.4 from npm (reproduced) and `master` at 493cd3e (same code, read) |

---

## Title

Setting `alterLibraryLanguageFile` removes `libraryStrings` (and every other key) from library language files

## Body

### Environment

- `@lumieducation/h5p-server` 10.0.4 (npm); the same code is on `master` at 493cd3e
  (`packages/h5p-server/src/LibraryManager.ts`, `getLanguageWithoutFallback`).
- H5P Core 1.28.0 and the editor client at `h5p-editor-php-library` commit ab2daa18; Node.js 24.

### Steps to reproduce

1. Take a library whose language file has more than `semantics`. A minimal one, `H5P.Probe 1.0`, in a folder for
   `FileLibraryStorage`: `library.json` =
   `{"title":"Probe","machineName":"H5P.Probe","majorVersion":1,"minorVersion":0,"patchVersion":0,"runnable":0,"preloadedJs":[]}`,
   `semantics.json` = `[{"name":"label","type":"text","default":"Paste"}]` and `language/nn.json` =
   `{"semantics":[{"default":"Lim inn"}],"libraryStrings":{"paste":"Lim inn"}}`.
2. Create a `LibraryManager` with `alterLibraryLanguageFile` set to a hook that changes nothing:
   `(library, semantics) => semantics`.
3. Call `getLanguage(library, 'nn')`, with and without the hook. As a script, saved as `repro.mjs` where
   `@lumieducation/h5p-server` 10.0.4 is installed and run with `node repro.mjs <folder>`:

```js
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
const folder = process.argv[2];
const library = { machineName: 'H5P.Probe', majorVersion: 1, minorVersion: 0 };
const plain = new LibraryManager(new fsImplementations.FileLibraryStorage(folder));
const hooked = new LibraryManager(new fsImplementations.FileLibraryStorage(folder), undefined, undefined,
  (_library, semantics) => semantics);
console.log('without the hook:', await plain.getLanguage(library, 'nn'));
console.log('with the hook:   ', await hooked.getLanguage(library, 'nn'));
```

### Expected

With a hook that returns the semantics unchanged, the language file is returned unchanged:
`{"semantics":[{"default":"Lim inn"}],"libraryStrings":{"paste":"Lim inn"}}`.

### Actual

Without the hook the file is returned whole. With it:

```text
{"semantics":[{"default":"Lim inn"}]}
```

`getLanguageWithoutFallback` returns `JSON.stringify({ semantics: hook(...) })`, so every other key of the language
file is lost once the hook is set, for every library and language. A real library shows it worse: H5P.DragNBar
1.5.23's `language/nn.json` holds only `libraryStrings` (the editor toolbar's texts, such as `paste`), so with the
same hook `getLanguage` returns `{}` for it (we ran this against the library's own files). The editor's
`H5PEditor.t` then finds no `libraryStrings` and shows its placeholder, in English
`[Missing translation editLabel]`, in place of DragNBar's texts, such as its context menu's "Edit", "Copy" and
"Remove", in the CoursePresentation and InteractiveVideo editors. The documentation recommends using `alterLibraryLanguageFile`
together with `alterLibrarySemantics` for languages other than English, so anyone who follows it loses these texts.

### Suggested fix

Keep the parsed file and replace only its `semantics`, and only when it has some:

```ts
const languageFile = JSON.parse(languageFileAsString);
if (languageFile.semantics !== undefined) {
  languageFile.semantics = this.alterLibraryLanguageFile(library, languageFile.semantics, language);
}
return JSON.stringify(languageFile);
```

Tests with a language file that has `libraryStrings` beside `semantics`, and one that has only `libraryStrings`,
would cover it.

### Our workaround

We do not set the hook. Our own texts for Nynorsk and Bokmål are applied by a wrapper around the library storage,
which changes the fields it is given and keeps every other key, `libraryStrings` included
(`apps/server/src/h5p/storage/LanguageOverlayLibraryStorage.ts` with `apps/server/src/h5p/languageOverlay/`). Our
tests `LanguageOverlayLibraryStorage.test.ts`, `applyLanguageOverlay.test.ts` and `languageOverlay.int.test.ts`
(among them "[H5P-008] the editor's toolbar strings (H5P.DragNBar) arrive in Nynorsk with every key H5P ships") check
that the editor's library data keeps `libraryStrings`; `languageOverlay.browser.int.test.ts` plays the result in the
player and the editor.
