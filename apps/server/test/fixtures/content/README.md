# Content fixtures for the pre-publish validator (apps/server)

Whole H5P activities in the real parameter shape (content.json), one folder per rule, used by the per-rule tests
in `test/validation/rules/` and by `test/validation/contentFixtures.test.ts` (`UD-021`, `PED-020`). The shapes follow
the semantics of the real libraries (D-078) and the examples in `tools/h5p-libraries/examples/`.

Each file has `description`, `mainLibrary`, `metadata`, optionally `context` (overrides such as captioned media
origins), `params`, and `expected`: the exact hits (`path` from the params root and message key) the rule must give.

- `positive-*.json`: the rule must fire, with exactly the hits in `expected`.
- `negative-*.json`: the rule must stay silent (`expected` is empty); these are the near misses a rule must not flag.

Tests run with the thresholds of spec 04 §5 (`TEST_CONTEXT` in `test/validation/support/ruleFixtures.ts`), not with
the editable `content/laeringsdesign/hint-thresholds.yaml`. Every file below is listed, and a test fails when one is
missing from this README.

## V-IMG-ALT

| Fixture | What it represents |
|---|---|
| `V-IMG-ALT/negative-described-decorative-and-empty.json` | A described image, a decorative image without alt text, and an image element with no file yet. |
| `V-IMG-ALT/positive-branching-start-image-without-alt.json` | A BranchingScenario start image whose alt text is blank. |
| `V-IMG-ALT/positive-empty-alt-in-column.json` | An H5P.Image inside a Column with an empty alt text. |
| `V-IMG-ALT/positive-file-name-alt-in-course-presentation.json` | An image on a slide whose alt text is a camera file name. |
| `V-IMG-ALT/positive-file-name-alt-in-interactive-book.json` | An image two levels down (book → chapter → image) with the alt text «bilde». |
| `V-IMG-ALT/positive-hotspots-background-without-alt.json` | An ImageHotspots background image with no alt-text field at all. |

## V-IMG-ALT-LENGTH

| Fixture | What it represents |
|---|---|
| `V-IMG-ALT-LENGTH/negative-at-limit-and-decorative.json` | An alt text of exactly 250 characters, and a long alt text on a decorative image. |
| `V-IMG-ALT-LENGTH/positive-long-alt.json` | An image whose alt text is 307 characters long. |

## V-VID-CAPTIONS

| Fixture | What it represents |
|---|---|
| `V-VID-CAPTIONS/negative-captioned-by-origin.json` | The same Panopto video with its origin listed in CAPTIONED_MEDIA_ORIGINS. |
| `V-VID-CAPTIONS/negative-subtitles-track-and-no-file.json` | An InteractiveVideo with a subtitles track, and an H5P.Video with no source yet. |
| `V-VID-CAPTIONS/positive-interactive-video-without-tracks.json` | An InteractiveVideo with an uploaded file and no text track. |
| `V-VID-CAPTIONS/positive-panopto-origin-not-listed.json` | A Panopto video without tracks while CAPTIONED_MEDIA_ORIGINS is empty. |
| `V-VID-CAPTIONS/positive-video-descriptions-track.json` | An H5P.Video in a Column whose only track is marked «descriptions», so it is not shown as captions. |

## V-VID-TRANSCRIPT

| Fixture | What it represents |
|---|---|
| `V-VID-TRANSCRIPT/negative-no-video-file.json` | An InteractiveVideo without a video file yet: nothing to transcribe. |
| `V-VID-TRANSCRIPT/negative-transcript-link.json` | An H5P.Video next to a text that links to its transcript. |
| `V-VID-TRANSCRIPT/positive-video-without-transcript.json` | A captioned InteractiveVideo with no transcript mentioned anywhere. |

## V-HOTSPOT-ORDER

| Fixture | What it represents |
|---|---|
| `V-HOTSPOT-ORDER/negative-numbered.json` | Numbered hotspots in any position, all with headers. |
| `V-HOTSPOT-ORDER/negative-reading-order.json` | Icon hotspots listed in reading order: a row (y 20 and 24), then a lower one. |
| `V-HOTSPOT-ORDER/positive-unordered-and-untitled.json` | Icons (not numbers) in a list order that jumps around the image, and one hotspot without a header. |

## V-TABLE-HEADERS

| Fixture | What it represents |
|---|---|
| `V-TABLE-HEADERS/negative-header-row-and-column.json` | H5P.Table's default table (header row) and a table with a header column. |
| `V-TABLE-HEADERS/positive-tables-without-header-cells.json` | An H5P.Table and an AdvancedText, each with a table of <td> cells only. |

## V-HEADING-ORDER

| Fixture | What it represents |
|---|---|
| `V-HEADING-ORDER/negative-ordered-headings.json` | h2 → h3 → h3 → h2 in one text, and a text that starts at h3. |
| `V-HEADING-ORDER/positive-h2-to-h4.json` | A text with an h2 followed directly by an h4. |

## V-LINK-TEXT

| Fixture | What it represents |
|---|---|
| `V-LINK-TEXT/negative-descriptive-links.json` | Links whose texts say where they lead. |
| `V-LINK-TEXT/positive-bare-urls.json` | A link whose text is its address, and an H5P.Link with no title (shown as its URL). |
| `V-LINK-TEXT/positive-vague-link-text.json` | A link whose text is «klikk her». |

## V-LANG

| Fixture | What it represents |
|---|---|
| `V-LANG/negative-language-set.json` | Metadata with defaultLanguage nn. |
| `V-LANG/positive-missing-language.json` | Metadata without defaultLanguage. |
| `V-LANG/positive-undetermined-language.json` | Metadata with H5P's «und» (undetermined). |

## V-COLOUR-WORDS

| Fixture | What it represents |
|---|---|
| `V-COLOUR-WORDS/negative-colour-as-answer.json` | A question about colour with colour names as answers, which is not colour coding. |
| `V-COLOUR-WORDS/positive-colour-phrases.json` | A question that points to «det raude feltet» and an answer that says «the green option». |

## V-BRANCH-COLOUR

| Fixture | What it represents |
|---|---|
| `V-BRANCH-COLOUR/negative-text-choices.json` | Choices with real text, one of which mentions a colour in passing. |
| `V-BRANCH-COLOUR/positive-colour-only-choices.json` | Three choices that are only a colour: «Raud», a green circle and «The green one». |

## PED-H01

| Fixture | What it represents |
|---|---|
| `PED-H01/negative-short-video.json` | An InteractiveVideo whose latest known point is a submit screen at 400 seconds. |
| `PED-H01/positive-long-video.json` | An InteractiveVideo with a bookmark at 20 minutes, so it is at least 20 minutes long. |

## PED-H02

| Fixture | What it represents |
|---|---|
| `PED-H02/negative-frequent-checks.json` | Tasks at 2, 5 and 8 minutes and a submit screen at 10 minutes: at most 3 minutes between checks. |
| `PED-H02/positive-labels-only.json` | Only a text and a link on the timeline, and a submit screen at 10 minutes: no task at all. |
| `PED-H02/positive-six-minute-gap.json` | Tasks at 1 and 7 minutes: 6 minutes without a check. |

## PED-H03

| Fixture | What it represents |
|---|---|
| `PED-H03/negative-ends-with-reflection.json` | No summary statements, but the last interaction is a free-text reflection. |
| `PED-H03/negative-summary-statements.json` | A summary task with statements. |
| `PED-H03/positive-default-summary.json` | H5P's default summary task: one statement group with no statements. |

## PED-H04

| Fixture | What it represents |
|---|---|
| `PED-H04/negative-fifteen-questions.json` | Exactly 15 questions (the limit). |
| `PED-H04/negative-pool-of-ten.json` | 20 questions, of which a random pool of 10 is shown. |
| `PED-H04/positive-sixteen-questions.json` | A QuestionSet with 16 questions. |

## PED-H05

| Fixture | What it represents |
|---|---|
| `PED-H05/negative-explained.json` | Every wrong option explains why. |
| `PED-H05/positive-true-false-in-question-set.json` | A TrueFalse in a QuestionSet with no feedback for a wrong answer. |
| `PED-H05/positive-wrong-options-without-explanation.json` | Three wrong options: blank feedback, no feedback group, and «Feil.» only. The right option has none, which is fine. |

## PED-H06

| Fixture | What it represents |
|---|---|
| `PED-H06/negative-two-decisions-with-loop.json` | Two decisions with feedback; a weak choice loops back to the first decision (as in the realistic example). |
| `PED-H06/positive-five-decisions.json` | Five decisions in a row on the main path, with feedback and backwards navigation. |
| `PED-H06/positive-one-decision-no-way-back.json` | One decision, one choice without feedback, no backwards navigation and no loop. |

## PED-H07

| Fixture | What it represents |
|---|---|
| `PED-H07/negative-on-or-default.json` | Retry and solutions on, set explicitly or left to the defaults. |
| `PED-H07/positive-course-presentation-summary-slide.json` | A CoursePresentation whose summary slide hides «Vis svar». |
| `PED-H07/positive-retry-and-solutions-off.json` | A QuestionSet that turns retry off for all questions and hides the solution at the end, with a MultiChoice that turns retry off itself. |

## PED-H08

| Fixture | What it represents |
|---|---|
| `PED-H08/negative-three-tasks-text-and-image.json` | Three tasks, a text and an image: texts and images are not tasks. |
| `PED-H08/positive-four-tasks.json` | A Column with four tasks and a text. |
| `PED-H08/positive-interactive-book-chapter.json` | An InteractiveBook chapter (a Column) with four tasks. |

## PED-H09

| Fixture | What it represents |
|---|---|
| `PED-H09/negative-words-in-questions-do-not-count.json` | 100 words of text and a long question on one slide: only the text counts. |
| `PED-H09/positive-wordy-slide.json` | The second slide has 160 words of text in two text boxes. |

## PED-H10

| Fixture | What it represents |
|---|---|
| `PED-H10/negative-long-chapter-with-task.json` | A chapter with 1 600 words and a task, and a short chapter without one. |
| `PED-H10/positive-long-chapter-without-task.json` | A chapter with 1 600 words (800 of them in an Accordion) and no task. |

## PED-H11

| Fixture | What it represents |
|---|---|
| `PED-H11/negative-explained-or-blank.json` | Overall feedback that starts with a verdict and explains, and a blank range (H5P shows the score instead). |
| `PED-H11/positive-verdict-only.json` | Overall feedback that is only «Feil!» / «Riktig!» in a MultiChoice, «Correct, well done!» at the end of a QuestionSet, and a TrueFalse that says only «Rett». |
