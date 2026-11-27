/**
 * lockFileCorrections — corrects npm's SBOM where its flags do not say what a production install contains: a
 * component is rewritten as npm writes it for the installed production copy, and a copy the lock file lists is not
 * called extraneous.
 *
 * Why: two things in npm's document differ from what the image's install keeps (D-148; SEC-007).
 *      (1) npm writes one component per `name@version`: the first installed copy it meets, with that copy's flags,
 *      hash and download address. When a dev tool carries its own copy of a package the server also uses in the same
 *      version, the one component says "development", and npmComponents.mjs would leave a runtime package out. On
 *      2026-11-27 that was tslib 2.8.1: @tailwindcss/oxide-wasm32-wasi 4.3.5 is no longer limited to wasm32, so its
 *      bundled copy is installed everywhere, and npm meets it before the copy the AWS SDK uses.
 *      UPSTREAM: https://github.com/npm/cli/blob/v11.19.1/lib/utils/sbom-cyclonedx.js (`childNodeMap` keeps the
 *      first node per ID).
 *      (2) npm calls a copy that no installed package needs extraneous and development, although the lock file
 *      lists it, and a production install keeps it when the lock file does not mark it dev
 *      (../dependency-check/lockFileProduction.mjs; @emnapi/runtime 1.11.3 on that day).
 * Spec: SEC-007
 * Invariants:
 *   - A copy is production when npm does not mark it dev, or when the lock file lists its folder as production
 *     (withLockFileProduction): the set check:licences checks. The root and the workspaces are never used as a copy.
 *   - Only a component npm marked development or extraneous is changed. With an installed production copy of the
 *     same name and version, it is rewritten as npm writes that copy: scope, download address, hash and the bundled
 *     flag from the copy's entry in package-lock.json, the address first among the references, keys in npm's order,
 *     and the copy's own edges from the installed tree. Without one, it only loses the extraneous flag when the lock
 *     file lists an installed copy of it, and stays development.
 *   - A production copy that package-lock.json lacks, or whose integrity value is not one sha512 value, is refused
 *     (check:lockfile holds the lock file to that form).
 *   - `runNpmQuery` runs `npm query --no-update-notifier` on the installed tree; it contacts no server. The rest
 *     only reads its arguments.
 * Collaborators: ./buildSbom.mjs (calls this before npmComponents.mjs filters), ./npmComponents.mjs (npm's flags),
 *   ../dependency-check/lockFileProduction.mjs, ../dependency-check/checkLockfile.mjs (the integrity form), npm.
 * Tests: tools/sbom/test/lockFileCorrections.test.mjs, tools/sbom/test/buildSbom.test.mjs (the real npm sbom)
 */
import { execFileSync } from 'node:child_process';
import { withLockFileProduction } from '../dependency-check/lockFileProduction.mjs';
import { DEVELOPMENT, EXTRANEOUS } from './npmComponents.mjs';

/** npm's property for a copy that sits inside another package's bundle. */
export const BUNDLED = 'cdx:npm:package:bundled';

const SHA512 = /^sha512-([A-Za-z0-9+/]{86}==)$/;
const NOT_PRODUCTION = [DEVELOPMENT, EXTRANEOUS];
const flag = (name) => ({ name, value: 'true' });
const refOf = (copy) => `${copy.name}@${copy.version}`;
const marked = (component, names) =>
  (component.properties ?? []).some((p) => names.includes(p.name) && p.value === 'true');
const without = (component, names) => (component.properties ?? []).filter((p) => !names.includes(p.name));

/**
 * Runs `npm query '*'` on the installed tree: every installed copy with its folder, npm's `dev` flag and its edges.
 * @param {string} root - The repository.
 * @returns {object[]} npm's list.
 */
export function runNpmQuery(root) {
  const out = execFileSync('npm', ['query', '*', '--no-update-notifier'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

/** npm's `hashes` value for a lock-file integrity value; a bundled copy has none. */
function hashesOf(integrity, location) {
  if (integrity === undefined) return undefined;
  const digest = SHA512.exec(integrity)?.[1];
  if (!digest) throw new Error(`package-lock.json: ${location} needs one sha512 integrity value`);
  return [{ alg: 'SHA-512', content: Buffer.from(digest, 'base64').toString('hex') }];
}

/** The component as npm writes it for the copy that `locked` describes, keys in npm's order. */
function asCopy(component, locked, location) {
  if (!locked) throw new Error(`package-lock.json lacks ${location}, which is installed (run npm ci)`);
  const kept = Object.entries(component).filter(([key]) => key !== 'hashes' && key !== 'licenses');
  const properties = without(component, [...NOT_PRODUCTION, BUNDLED]);
  const references = (component.externalReferences ?? []).filter((r) => r.type !== 'distribution');
  const hashes = hashesOf(locked.integrity, location);
  return {
    ...Object.fromEntries(kept),
    scope: locked.optional || locked.devOptional ? 'optional' : 'required',
    properties: locked.inBundle ? [...properties, flag(BUNDLED)] : properties,
    externalReferences: locked.resolved
      ? [{ type: 'distribution', url: locked.resolved }, ...references]
      : references,
    ...(hashes ? { hashes } : {}),
    ...(component.licenses ? { licenses: component.licenses } : {}),
  };
}

/**
 * Corrects npm's SBOM by the lock file: a component npm describes by a development or extraneous copy is rewritten
 * for the installed production copy of the same name and version; an extraneous one that the lock file lists, and
 * that has no production copy, becomes plain development.
 * @param {{components: object[], dependencies: {ref: string, dependsOn: string[]}[]}} npmBom - npm's document.
 * @param {{name: string, version: string, location: string, dev?: boolean, to?: string[]}[]} installed - Every
 *   installed copy (`npm query '*'`); an empty list corrects nothing.
 * @param {Record<string, object>} lockPackages - The lock file's `packages`: folder → entry.
 * @returns {object} The document; the same object when nothing needed correcting.
 * @throws {Error} When package-lock.json lacks a production copy, or its integrity value is not one sha512 value.
 */
export function withLockFileCorrections(npmBom, installed, lockPackages) {
  const inLockFile = (location) => Object.hasOwn(lockPackages, location);
  const byLocation = new Map(installed.map((copy) => [copy.location, copy]));
  const production = new Map();
  const listed = new Set();
  for (const copy of withLockFileProduction(installed, lockPackages)) {
    if (!copy.location?.includes('node_modules/')) continue;
    if (inLockFile(copy.location)) listed.add(refOf(copy));
    if (copy.dev !== true && !production.has(refOf(copy))) production.set(refOf(copy), copy);
  }
  const rewritten = new Map();
  const components = npmBom.components.map((component) => {
    const ref = component['bom-ref'];
    if (!marked(component, NOT_PRODUCTION)) return component;
    const copy = production.get(ref);
    if (!copy && !(marked(component, [EXTRANEOUS]) && listed.has(ref))) return component;
    rewritten.set(ref, copy);
    if (!copy)
      return { ...component, properties: [flag(DEVELOPMENT), ...without(component, NOT_PRODUCTION)] };
    return asCopy(
      component,
      inLockFile(copy.location) ? lockPackages[copy.location] : undefined,
      copy.location,
    );
  });
  if (rewritten.size === 0) return npmBom;
  const edgesOf = (copy) => [
    ...new Set((copy.to ?? []).flatMap((to) => (byLocation.has(to) ? [refOf(byLocation.get(to))] : []))),
  ];
  const dependencies = npmBom.dependencies.map((edge) =>
    rewritten.get(edge.ref) ? { ref: edge.ref, dependsOn: edgesOf(rewritten.get(edge.ref)) } : edge,
  );
  return { ...npmBom, components, dependencies };
}
