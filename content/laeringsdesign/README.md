# content/laeringsdesign — settings for læringsdesign

## hint-thresholds.yaml

Before an author publishes an activity, the validator gives pedagogical hints (spec 04 §5, `PED-H01` to
`PED-H11`), for example "the video is longer than 15 minutes" or "the question set has more than 15 questions".
These hints never block publishing; they are warnings or hints. The numbers they use are in
`hint-thresholds.yaml`, so ALU can adjust them without changing code.

| Key | Hint | Default | Allowed |
|---|---|---|---|
| `maxVideoMinutes` | `PED-H01`: an Interactive Video is longer than this (minutes) | 15 | more than 0, at most 180 |
| `maxMinutesWithoutInteraction` | `PED-H02`: a video runs this long without a task (minutes) | 4 | more than 0, at most 60 |
| `maxQuestionsPerSet` | `PED-H04`: a Question Set shows more questions than this | 15 | whole number, 1–100 |
| `minDecisionPoints` | `PED-H06`: a Branching Scenario has fewer decision points on its main path | 2 | whole number, 1–20 |
| `maxDecisionPoints` | `PED-H06`: … or more than this (must not be below `minDecisionPoints`) | 4 | whole number, 1–20 |
| `maxColumnActivities` | `PED-H08`: a Column holds more tasks than this | 3 | whole number, 1–50 |
| `maxSlideWords` | `PED-H09`: a Course Presentation slide has more words than this | 150 | whole number, 10–2000 |
| `maxChapterWordsWithoutInteraction` | `PED-H10`: an Interactive Book chapter without a task has more words | 1500 | whole number, 100–50000 |

### Example

To allow videos of up to 20 minutes before the hint appears, change one line:

```yaml
maxVideoMinutes: 20
```

Minutes may have decimals (`4.5`); counts are whole numbers. Lines starting with `#` are comments and are ignored.

### What catches mistakes

- The server checks the file when it starts. A missing, misspelt, repeated or out-of-range key stops the start,
  and the message names the key, for example
  `maxVideoMinutes: Too big: expected number to be <=180`.
- The test `apps/server/test/config/validationContext.test.ts` loads this file in every test run (also in CI on a
  pull request), so a broken file is caught before it is merged.
- Changing a number changes which hints authors see; the hint rules' own tests use fixed numbers, so they keep
  passing, and the test `apps/server/test/validation/realisticExamples.test.ts` shows which hints the ten example
  activities get.
