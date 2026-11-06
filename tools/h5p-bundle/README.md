# tools/h5p-bundle

## Purpose

Builds the **offline content-type bundle**: the ten real H5P content types (D-078) as `.h5p` packages with a
`SHA256SUMS`, in a folder of its own, so the Docker image (`deploy/Dockerfile`) and HVL's hosts can install them
without reaching GitHub (D-110 and its amendment of 2026-11-05, `NFR-007`). Every hop checks the hashes again: this
builder against the fetch's own list, the image build against the bundle's list, and the seeder (`H5P-003`) when it
installs.

The builder refuses:

| Problem | Why |
|---|---|
| A package that is missing, changed since its hash was listed, or not listed | The bundle must be exactly what was fetched and checked |
| A listed name that is not one of the ten types (for example `H5P.DragQuestion.h5p`) | CLAUDE.md §1: exactly ten authorable types |
| A package with a text file (scripts, JSON, HTML, CSS, Markdown, SVG, source maps and other text) that holds a build machine's secrets, by the rules every way in shares (`apps/server/src/h5p/libraries/libraryBuildSecrets.ts`): a variable whose name says secret (upper-case anywhere, such as `GH_TOKEN`, `PGPASSWORD`, `URL_SIGNING_KEYS`, `SENTRY_DSN`, `GH_PAT`; other names by their last word, such as `GhToken` or `npm_config__authtoken`) with a string, template or number; a URL with a password under any name (`https_proxy`); a value shaped like a known credential; or, in a dumped environment, any variable the minimal build environment does not set (D-110 amendment of 2026-11-06) | **SECURITY:** a library build that bakes its build machine's environment into JavaScript ships it to every learner and into every image. `H5P.AudioRecorder` 1.0 does this (`DefinePlugin` of `process.env`); the message names the package, the file and the variable, never the value. The seed command and an administrator's import run the same rules on library folders |
| A text file over 32 MB, or one whose search for a dumped environment uses up its work budget (`(too complex to scan)`) | It is refused rather than left unscanned |
| A bundle folder that is not empty | A bundle never mixes with an older one |

The SHA-256 list that D-110 keeps **in the repository** waits until the packages are reproducible across machines,
which the AudioRecorder build also prevents (it embeds the build environment). Until then the bundle carries the list
its builder wrote after these checks.

## How to run

```bash
npm run h5p:fetch-libraries                                    # where GitHub is reachable (D-078)
node tools/h5p-bundle/bundleCli.mjs build --out /tmp/hvli-bundle   # from apps/server/var/h5p-real/packages
node tools/h5p-bundle/bundleCli.mjs build --from <packages dir> --out <bundle dir>
node tools/h5p-bundle/bundleCli.mjs verify <bundle dir>        # what the image build runs
npx vitest run tools/h5p-bundle                                # the tests
```

Then install from it like any seed folder: `npm run seed:libraries -- <bundle dir>`, which scans the libraries again
and then the whole library folder (`npm run libraries:check` does only the latter). The image build takes the
folder as the build context `h5pbundle` (see [docs/ops/docker.md](../../docs/ops/docker.md)); its `inputs` stage needs
the rules file `apps/server/src/h5p/libraries/libraryBuildSecrets.ts` next to this tool, which Node 24 loads by
stripping its types.

If the build is refused for a secret, the packages were built before `tools/h5p-libraries` gave each library build
a minimal environment (`buildEnv` 3, D-110's image amendment): run `npm run h5p:fetch-libraries` again, which
rebuilds older builds in place, re-seed, never ship the refused packages, and rotate any token they held.

## Folder structure

| File | Responsibility |
|---|---|
| `contentTypeBundle.mjs` | The checks (hashes, the ten types, baked-in secrets) and the copy |
| `bundleCli.mjs` | The command: `build` and `verify` |
| `test/contentTypeBundle.test.mjs` | `[NFR-007]` tests of the hashes and the ten types, with small synthetic packages |
| `test/bundleSecretGuard.test.mjs` | `[NFR-007]` tests of the secret guard, `content/` included, and of `bundleCli` run under plain Node |
| `test/imageInputsStage.test.mjs` | `[NFR-007]` the image's `inputs` stage copies every script it runs and every file they import, the shared rules file too |
| `test/bundleFixtures.mjs` | The synthetic packages and fetch folders both test files use |
