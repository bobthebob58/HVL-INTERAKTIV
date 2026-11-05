# tools/sbom

## Purpose

Writes the software bill of materials (SBOM) of HVL Interaktiv,
[`docs/assurance/sbom.cdx.json`](../../docs/assurance/sbom.cdx.json), in CycloneDX 1.5 JSON. Its code and tests are
traced to `SEC-007` (dependency hygiene), which does not itself ask for an SBOM. It is part of the assurance pack for
HVL IT ([`docs/assurance/`](../../docs/assurance/README.md)): a list of what the service is made of, with versions, pins
and licences, that IT can feed to a scanner such as OWASP Dependency-Track or compare with advisories.

| Kind | Count (2026-11-05) | Read from | Pinned by |
|---|---|---|---|
| npm packages a production install contains, our 5 workspaces among them | 477 | `npm sbom` of the installed tree, filtered (see below) | `package-lock.json`: version and SHA-512 integrity (472 have a hash; the 5 workspaces are folders) |
| H5P core and H5P editor client files | 2 | `tools/h5p-core/fetchCoreClients.sh` | core: tag `1.28.0` at commit `2aeb0b83…`; editor: commit `ab2daa18…` (D-022); one SHA-256 per file in `docs/reference/h5p-core-1.28-seed-packages/` |
| The ten authorable H5P content types | 10 | `tools/h5p-libraries/libraries.manifest.json`, at the roots in `resolveManifest.mjs` | repository, ref and commit per type (D-078) |
| Container images | 3 | the `FROM` lines of `deploy/Dockerfile` (`ubuntu`, `node`) and the `clamav` service of `deploy/compose.app.yml` | sha256 digest |

The ClamAV image has scope `excluded`: it is the scanner of the local stack and CI, not part of the server image. In
production the server uses the clamd that `CLAMAV_HOST` names, which the operator runs; without it the server starts
only with `CLAMAV_ALLOW_UNSCANNED_UPLOADS=true` (`apps/server/src/config/env.ts`, D-110).

## How to run

```bash
npm ci                         # the SBOM describes the installed tree, so install from the lockfile first
npm run sbom                   # write docs/assurance/sbom.cdx.json and print its size and counts
npm run sbom -- --check        # exit 1 when the committed file is not what the tree and the pins give
npx vitest run tools/sbom      # the [SEC-007] tests; one of them runs the real npm sbom and npm query
```

Regenerate and commit the file after any change to `package-lock.json`, `tools/h5p-core/fetchCoreClients.sh` or the
hash lists it names, the library manifest or `CONTENT_TYPE_ROOTS` in `tools/h5p-libraries/resolveManifest.mjs`,
`REVIEWED` in `tools/dependency-check/checkLicences.mjs`, or an image line in `deploy/Dockerfile` or
`deploy/compose.app.yml`, and after an npm upgrade. CI does not run `--check` yet; it runs the `[SEC-007]` tests
below as part of `npm test` (`.github/workflows/ci.yml`).

## How the npm part is made

`npm sbom --omit dev` is **not** used. npm's `.dev` selector drops every package reached through any
`devDependencies` edge, even when a runtime dependency needs it too. On 2026-11-05 it gave 239 of the 477 production
packages and missed `playwright-core`, `tsx`, `react` and `prisma`; `NODE_ENV=production` has the same effect.
Instead the command runs `npm sbom --sbom-format cyclonedx --sbom-type application` with `--include=dev`,
`--include=optional` and `--include=peer` (and `--no-update-notifier`, so npm does not ask the registry for a newer
npm), and keeps every component npm did not mark:

- `cdx:npm:package:development`: npm sets it only when dev dependencies alone need a package. It is the flag
  `npm query '*'` reports as `dev` and `check:licences` uses (D-071), so the SBOM and the licence check see the same
  production set. A test compares the two. The counts differ only in how they count: `check:licences` reports 488
  entries because it counts the root and every install location (6 packages, such as `mime-db@1.54.0`, sit in two to
  four folders), while the SBOM lists each `name@version` once (477).
- `cdx:npm:package:extraneous`: installed, but not in `package-lock.json`. The command names such packages; run
  `npm ci`.

Like `check:licences`, it refuses (writing nothing) when the set lacks a workspace or a runtime dependency that a
manifest declares (`productionSetGuard.mjs`, D-113). npm's data is kept as npm wrote it: licences, purls, hashes,
references, and npm's `scope`, where `optional` means that npm marks the package optional; it does not mean "not
shipped" (`prisma`, for example, is `optional` and is in the server image). Two things change: `name` is the package
name (npm names a workspace after its folder, `server`, and the root after the checkout folder), and a licence listed
in `REVIEWED` in `tools/dependency-check/checkLicences.mjs` replaces npm's (today `esprima@1.2.5`, for which npm gives
none, and `@visx/vendor@4.0.0-alpha.0`, whose `MIT and ISC` is not valid SPDX), marked `hvl:licence:reviewed-in`.
Those two licences were read from the packages' licence files by the AI that wrote this code; no human has checked
them yet ([`human-review.md`](../../docs/assurance/human-review.md)).

**Platform.** An installed tree holds the optional native packages of its own platform only (for example
`@esbuild/linux-x64`, `@next/swc-linux-x64-gnu`, `@img/sharp-linux-x64`). The committed file was made on
`linux-x64`, which is also what CI's `ubuntu-24.04` runners install. The metadata property `hvl:npm:platform`
records it, and `--check` on another platform says why the file differs.

## Deterministic output

The file has no time stamp and no tool versions. Its serial number is a name-based UUID (version 5) of the rest of the
document, so it changes exactly when the content does. Components are sorted by `bom-ref` and their properties by
name; dependencies are sorted, with every `dependsOn` sorted and without duplicates. The same installed tree, lockfile,
pin files and npm version therefore give the same bytes, and `--check` compares text. npm's version is not pinned in
the repository; the committed file was made with npm 11.19.1 (Node.js 24.22.1), and two runs gave identical bytes.
The root component keeps npm's edges to the packages that stay and also depends on the H5P components and the two
Dockerfile images (`ubuntu`, `node`), not on ClamAV; every added component has its own (empty) entry in the
dependency graph.

## Properties we add

| Property | On | Meaning |
|---|---|---|
| `hvl:sbom:source` | H5P components, images | The file the pin was read from |
| `hvl:git:ref`, `hvl:git:untagged` | H5P components | The tag or commit fetched; `untagged` when the library has no release tag of the required major.minor and the default branch's commit is pinned, marked for review (`resolveManifest.mjs`). None of the ten content types is untagged today |
| `hvl:h5p:npm-build` | content types | `true` when the library is built with its own npm lockfile and build script before packing |
| `hvl:file-hashes`, `hvl:file-count` | core, editor | The committed per-file SHA-256 list the fetch and the image build check, and its number of files |
| `hvl:dockerfile:stage`, `hvl:compose:service` | images | Where the image is used |
| `hvl:licence:reviewed-in` | npm packages | The licence comes from `check:licences`' reviewed list, not from npm |
| `hvl:npm:platform` | metadata | The platform whose native npm packages are listed |

The commit of each H5P component is also in its purl (`pkg:github/<owner>/<repo>@<commit>`) and in
`pedigree.commits`; an image's digest is in its purl (`pkg:oci/…@sha256%3A…`) and its `hashes`.

## What the file does not list

- The other H5P libraries that the ten content-type packages carry: they install 77 libraries in all (Docker smoke,
  `PROGRESS.md`), and the manifest pins 120, 3 of them untagged. Only the ten content types are components; the
  manifest is the full list.
- The npm trees of the 23 H5P libraries built with webpack (each has its own lockfile, outside our tree).
- What the image build fetches outside npm: Chromium `chromium-1194` (Playwright's download), Prisma's engine binary
  (the `@prisma/engines` install script), and the Ubuntu packages for Chromium, fonts and `tini`, which have no
  version pins (`deploy/Dockerfile`).
- The other images (PostgreSQL, Redis and moto in the local stack and CI; k6 in `tools/load`; BuildKit in
  `deploy/smoke/smokeBuild.sh`) and the GitHub Actions the workflows use.
- The licences of the H5P components and images: the pin files do not record them.
- The vendored seccomp profile (`deploy/seccomp/`, checked by hash in `tools/deploy-check`).

On 2026-11-05 the AI author validated the file once against the CycloneDX 1.5 JSON schema (`bom-1.5.schema.json`,
with `spdx.schema.json` and `jsf-0.82.schema.json`, from the CycloneDX specification repository) with the ajv 6.15.0
in `node_modules`, and it was valid. ajv 6 does not check the schema's `iri-reference` and `idn-email` formats. That
check is not automated and no human has repeated it: the schema is not in the repository.

## Folder structure

| File | Responsibility |
|---|---|
| `buildSbom.mjs` | The command: runs `npm sbom`, joins the parts, writes or checks the file |
| `npmComponents.mjs` | The production part of npm's SBOM, package names, reviewed licences, the production-set guard |
| `h5pComponents.mjs` | H5P core, editor and the ten content types from their pin files |
| `imageComponents.mjs` | The Dockerfile's base images and the ClamAV image, by digest |
| `assembleSbom.mjs` | One sorted document with a content-derived serial number; counts by kind |
| `test/sbomFixtures.mjs` | A small npm SBOM and a throwaway repository with copies of the real pin files |

## Tests

`test/npmComponents.test.mjs`, `test/sourceComponents.test.mjs` and `test/buildSbom.test.mjs` (22 tests on
2026-11-05), titled `[SEC-007]`:
the H5P and image components carry their pins; the same input gives the same bytes in any order; `--check` finds a
stale, missing or other-platform file; a shrunken npm set is refused; npm components keep npm's licences and purls.
One test runs the real `npm sbom` (with `npm_config_omit=dev` set, as `NODE_ENV=production` would) and `npm query '*'`
and checks that the npm part is exactly the production set the licence check sees.
