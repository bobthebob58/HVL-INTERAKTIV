#!/usr/bin/env node
/**
 * buildSbom — `npm run sbom`: writes the CycloneDX SBOM of HVL Interaktiv to docs/assurance/sbom.cdx.json, or, with
 * `--check`, says whether the committed file is current.
 *
 * Why: HVL IT will want to know what the service is made of before they host it, and to check it against
 *      advisories (docs/assurance/; SEC-007). npm's SBOM sees only npm packages; H5P's core, editor and content types
 *      come from GitHub, and the server image rests on container images.
 * Spec: SEC-007
 * Invariants:
 *   - Deterministic: the same installed tree, lockfile, pin files and npm version give the same bytes
 *     (assembleSbom.mjs), so `--check` compares text. npm's version is not pinned; npm 11.19.1 made the committed file.
 *   - `--check` writes nothing; it exits 1 when the file is missing or differs, and names the command that fixes it.
 *   - Refuses, writing nothing, when npm's production set lacks a workspace or a declared runtime dependency, or a
 *     pin cannot be read.
 *   - Reads files and runs `npm sbom --no-update-notifier` on the installed tree; it contacts no server.
 * Usage:
 *   npm run sbom                      write docs/assurance/sbom.cdx.json
 *   npm run sbom -- --check           exit 1 when the committed file is not current
 *   npm run sbom -- --out=<file>      write (or with --check, compare) another file
 * Collaborators: ./npmComponents.mjs, ./h5pComponents.mjs, ./imageComponents.mjs, ./assembleSbom.mjs,
 *   ../dependency-check/productionSetGuard.mjs, npm (`npm sbom`).
 * Tests: tools/sbom/test/buildSbom.test.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkspaceManifests } from '../dependency-check/productionSetGuard.mjs';
import { PLATFORM_PROPERTY, SBOM_PATH, assembleSbom, countsByKind, serialise } from './assembleSbom.mjs';
import { LIBRARY_MANIFEST, contentTypeComponents, coreComponents } from './h5pComponents.mjs';
import { COMPOSE_FILE, DOCKERFILE, dockerfileImages, scannerImage } from './imageComponents.mjs';
import { incompleteNpmSet, productionPart } from './npmComponents.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Runs `npm sbom` on the installed tree, dev packages included (productionPart filters them by npm's own flag).
 * WHY: `--include` keeps npm's `.dev` selector (under `NODE_ENV=production` or `omit=dev`) from dropping runtime
 * packages a dev tool also uses (npmComponents.mjs); `--no-update-notifier` keeps npm from asking the registry.
 * @param {string} root - The repository.
 * @returns {object} npm's CycloneDX document.
 */
export function runNpmSbom(root) {
  const args = ['sbom', '--sbom-format', 'cyclonedx', '--sbom-type', 'application', '--no-update-notifier'];
  const out = execFileSync('npm', [...args, '--include=dev', '--include=optional', '--include=peer'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

/**
 * Builds the SBOM text from the repository's files and npm's document.
 * @param {string} root - The repository.
 * @param {object} npmBom - npm's CycloneDX document of the installed tree.
 * @param {string} platform - `<platform>-<arch>` of the installed tree.
 * @returns {{text?: string, bom?: object, problems: string[], extraneous: string[]}} The text and document, or the
 *   problems that stop it; `extraneous` lists installed packages the lockfile does not have (left out).
 * @throws {Error} When a pin file is missing or a pin in it cannot be read.
 */
export function buildSbom(root, npmBom, platform) {
  const npm = productionPart(npmBom);
  const problems = incompleteNpmSet(readWorkspaceManifests(root), npm.components);
  if (problems.length > 0) return { problems, extraneous: npm.extraneous };
  const readText = (file) => readFileSync(join(root, file), 'utf8');
  const added = [
    ...coreComponents(readText),
    ...contentTypeComponents(JSON.parse(readText(LIBRARY_MANIFEST))),
    ...dockerfileImages(readText(DOCKERFILE)),
    scannerImage(readText(COMPOSE_FILE)),
  ];
  const bom = assembleSbom({ npmBom, npm, added, platform });
  return { text: serialise(bom), bom, problems: [], extraneous: npm.extraneous };
}

/**
 * One line about the document: its size and its components by kind.
 * @param {object} bom - The document.
 * @param {string} text - Its text.
 * @returns {string} For example `566 KiB; 477 npm packages (5 of them our workspaces), 12 H5P components, …`.
 */
export function summary(bom, text) {
  const c = countsByKind(bom);
  const kinds = [
    `${c.npm} npm packages (${c.workspaces} of them our workspaces)`,
    `${c.h5p} H5P components`,
    `${c.images} container images`,
    ...(c.other > 0 ? [`${c.other} others`] : []),
  ];
  return `${Math.round(Buffer.byteLength(text) / 1024)} KiB; ${kinds.join(', ')}`;
}

const platformOf = (text) => {
  try {
    return JSON.parse(text).metadata?.properties?.find((p) => p.name === PLATFORM_PROPERTY)?.value;
  } catch {
    return undefined;
  }
};

/**
 * Runs the command.
 * @param {string[]} argv - Arguments after the script.
 * @param {object} [seams] - Replaceable parts, for the tests.
 * @param {string} [seams.root] - The repository.
 * @param {(root: string) => object} [seams.npmSbom] - Produces npm's document.
 * @param {string} [seams.platform] - `<platform>-<arch>`.
 * @returns {number} The exit code.
 */
export function main(argv, seams = {}) {
  const { root = ROOT, npmSbom = runNpmSbom, platform = `${process.platform}-${process.arch}` } = seams;
  const check = argv.includes('--check');
  const outArg = argv.find((a) => a.startsWith('--out='))?.slice('--out='.length);
  const out = outArg ? resolve(outArg) : join(root, SBOM_PATH);
  const shown = relative(root, out).startsWith('..') ? out : relative(root, out);
  const { text, bom, problems, extraneous } = buildSbom(root, npmSbom(root), platform);
  if (extraneous.length > 0) {
    const names = extraneous.join(', ');
    console.warn(
      `! sbom: left out ${extraneous.length} packages that package-lock.json lacks (run npm ci): ${names}`,
    );
  }
  if (problems.length > 0) {
    for (const p of problems) console.error(`✗ sbom: ${p}`);
    return 1;
  }
  if (!check) {
    writeFileSync(out, text);
    console.log(`✓ sbom: wrote ${shown}: ${summary(bom, text)}`);
    return 0;
  }
  const committed = existsSync(out) ? readFileSync(out, 'utf8') : undefined;
  if (committed === text) {
    console.log(`✓ sbom: ${shown} is current: ${summary(bom, text)}`);
    return 0;
  }
  const made = committed === undefined ? undefined : platformOf(committed);
  const why =
    made && made !== platform ? ` It lists the npm packages of ${made}; this machine is ${platform}.` : '';
  console.error(
    `✗ sbom: ${shown} is ${committed === undefined ? 'missing' : 'not current'}.${why} Run: npm run sbom`,
  );
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`✗ sbom: ${error.message}`);
    process.exitCode = 1;
  }
}
