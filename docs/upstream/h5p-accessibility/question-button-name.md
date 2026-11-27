# Draft: H5P accessibility report, H5P.Question 1.5, a button's name without the word it shows

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-question` (and the language files of `h5p/h5p-multi-choice`) |
| **Channel** | A public GitHub issue on `h5p/h5p-question`, with H5P's Bug Report form (see the README); the untranslated texts go as a pull request to the language files, as H5P's contribution guide asks |
| **Status** | Needs the owner's check: whether to file the issue, the language pull request, or both |
| **WCAG 2.2** | 2.5.3 Label in Name |
| **Our records** | D-151 (repair (m)), D-111 (our language overlay), D-080 |
| **Checked** | 2026-11-27 against H5P.Question 1.5.47 (commit fffb3c86) and H5P.MultiChoice 1.16 (`language/nn.json`, `language/nb.json`) |

---

## Title

[Bug]: Accessibility: a button's `aria-label` replaces its visible text, so a label in other words gives a name without the shown word (WCAG 2.5.3)

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 159, through Playwright 1.65.1)
- **Operating system:** Linux, Ubuntu 24.04

### Versions

- H5P.Question 1.5.47 (commit fffb3c86), seen through H5P.MultiChoice 1.16; H5P Core 1.28.0.
- Chromium 159 (Playwright 1.65.1), axe-core 4.14.1. Our host runs Lumi's Node.js server; the markup comes from
  the libraries.

### Steps to reproduce

1. Create a Multiple Choice in Norwegian Nynorsk (or Bokmål) and leave every text at the default of the library's
   language file.
2. View it and run axe on the player document (axe-core 4.14 runs `label-content-name-mismatch` by default).

### Expected

The "Sjekk" button's accessible name contains "Sjekk", the word it shows (WCAG 2.5.3), whatever the content's
text for assistive technology says.

### Actual

`scripts/question.js` (`addButton`) writes the content's `a11yCheck` as the button's `aria-label` and the
content's `checkAnswerButton` as its text:

```html
<button class="h5p-question-check-answer h5p-joubelui-button" type="button"
        aria-label="Check the answers. The responses will be marked as correct, incorrect, or unanswered.">Sjekk</button>
```

H5P.MultiChoice's `language/nn.json` and `language/nb.json` translate `checkAnswerButton` and leave `a11yCheck`,
`a11yShowSolution` and `a11yRetry` in English, so every Multiple Choice made in those languages gets this button.
The same happens whenever an author rewrites one of the two texts. axe reports `label-content-name-mismatch`
(serious): a person who says "Sjekk" to a speech-input tool does not reach the button.

### Suggested fix

In H5P.Question, build the name from the visible text and the longer text (for example the visible text first,
or the longer text as `aria-description`), so that the name always holds the shown word. In the language files,
translate the three `a11y…` texts so that they start with the button's word, as the Nynorsk files of Fill in the
Blanks and Drag the Words already do.

### Our workaround

Activities made in our editor get translated texts that start with the button's word, from our language overlay
(`content/h5p-tekstar/`, D-111). For content saved with other texts, `packages/hvl-h5p-theme/src/a11yRepairs.js`
puts the shown word first in the name at run time ("Sjekk. Check the answers. …") and follows a label or word
that H5P writes later. Our tests: `a11yRepairsLabelInName.test.ts` and the axe suites that play the Multiple
Choice package (`axeWebRoutes.a11y.test.ts`).
