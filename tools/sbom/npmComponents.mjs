/**
 * npmComponents — turns npm's CycloneDX SBOM of the installed tree into the npm part of ours: every package a
 * production install contains, with npm's own licences, purls and hashes, and the dependency edges between them.
 *
 * Why: `npm sbom --omit dev` is incomplete here. Its `.dev` selector drops every package reached through any
 *      devDependency edge, even when a runtime dependency needs it too: on 2026-11-05 it kept 239 of the 477
 *      production packages and lost playwright-core, tsx and react. npm marks a component
 *      `cdx:npm:package:development` only when dev dependencies alone need it, which is the same flag `npm query '*'`
 *      reports as `dev` and check:licences uses (D-071, D-113). So the full SBOM is filtered by that flag (SEC-007).
 * Spec: SEC-007
 * Invariants:
 *   - A component stays only when npm marked it neither development nor extraneous (installed, but not in
 *     package-lock.json). The dependency graph keeps only edges between components that stay.
 *   - npm's data is kept as npm wrote it, with two exceptions: `name` is the package name (npm names a workspace
 *     after its folder, `server` for `@hvl-interaktiv/server`, and the root after the checkout folder), and a licence
 *     that check:licences records in REVIEWED replaces npm's, marked by a property. REVIEWED was read from the
 *     packages' licence files by the AI that wrote this code; no human has checked it yet.
 *   - The set must hold every workspace and every runtime dependency the manifests declare (productionSetGuard.mjs);
 *     otherwise it is refused, as check:licences refuses it.
 * Collaborators: ../dependency-check/checkLicences.mjs (REVIEWED), ../dependency-check/productionSetGuard.mjs,
 *   ./buildSbom.mjs.
 * Tests: tools/sbom/test/npmComponents.test.mjs, tools/sbom/test/buildSbom.test.mjs (the real npm sbom)
 */
import { REVIEWED } from '../dependency-check/checkLicences.mjs';
import {
  expectedProductionPackages,
  incompleteSetProblems,
} from '../dependency-check/productionSetGuard.mjs';

/** npm's property for a package that only dev dependencies need. */
export const DEVELOPMENT = 'cdx:npm:package:development';
/** npm's property for a package in node_modules that package-lock.json does not list. */
export const EXTRANEOUS = 'cdx:npm:package:extraneous';
/** Our property on a component whose licence comes from check:licences' REVIEWED list. */
export const REVIEWED_LICENCE = 'hvl:licence:reviewed-in';

/**
 * The package name in an npm `bom-ref` (`name@version`, the name possibly scoped).
 * @param {string} ref - For example `@hvl-interaktiv/server@0.1.0`.
 * @returns {string} For example `@hvl-interaktiv/server`.
 */
export const packageName = (ref) => ref.replace(/@[^@/]+$/, '');

const hasProperty = (component, name) =>
  (component.properties ?? []).some((p) => p.name === name && p.value === 'true');

/**
 * Turns an SPDX expression or identifier into CycloneDX's `licenses` value, as npm does.
 * @param {string} spdx - For example `BSD-2-Clause` or `MIT AND ISC`.
 * @returns {object[]} `[{ license: { id } }]` for one identifier, `[{ expression }]` otherwise.
 */
export const licensesOf = (spdx) => (/\s/.test(spdx) ? [{ expression: spdx }] : [{ license: { id: spdx } }]);

/**
 * Gives one npm component its package name and, when check:licences reviewed it, the reviewed licence.
 * @param {object} component - A component (or the root) as npm wrote it.
 * @param {Record<string, string>} reviewed - `name@version` → SPDX expression (check:licences' REVIEWED).
 * @returns {object} The component, keys in npm's order.
 */
export function normaliseComponent(component, reviewed) {
  const name = packageName(component['bom-ref']);
  const licence = reviewed[`${name}@${component.version}`];
  if (!licence) return { ...component, name };
  const properties = [
    ...(component.properties ?? []),
    { name: REVIEWED_LICENCE, value: 'tools/dependency-check/checkLicences.mjs' },
  ];
  return { ...component, name, properties, licenses: licensesOf(licence) };
}

/**
 * Keeps the production part of npm's SBOM.
 * @param {{metadata: {component: object}, components: object[], dependencies: object[]}} npmBom - The output of
 *   `npm sbom --sbom-format cyclonedx` for the whole tree (dev packages included).
 * @param {Record<string, string>} [reviewed] - Reviewed licences; defaults to check:licences' REVIEWED.
 * @returns {{root: object, components: object[], dependencies: {ref: string, dependsOn: string[]}[],
 *   development: number, extraneous: string[]}} The root, the kept components and edges, and what was left out.
 */
export function productionPart(npmBom, reviewed = REVIEWED) {
  const root = normaliseComponent(npmBom.metadata.component, reviewed);
  const extraneous = npmBom.components.filter((c) => hasProperty(c, EXTRANEOUS)).map((c) => c['bom-ref']);
  const development = npmBom.components.filter((c) => hasProperty(c, DEVELOPMENT)).length;
  const components = npmBom.components
    .filter((c) => !hasProperty(c, DEVELOPMENT) && !hasProperty(c, EXTRANEOUS))
    .map((c) => normaliseComponent(c, reviewed));
  const kept = new Set([root['bom-ref'], ...components.map((c) => c['bom-ref'])]);
  const dependencies = npmBom.dependencies
    .filter((d) => kept.has(d.ref))
    .map((d) => ({ ref: d.ref, dependsOn: d.dependsOn.filter((ref) => kept.has(ref)) }));
  return { root, components, dependencies, development, extraneous };
}

/**
 * Finds what makes the kept set smaller than a production install: a missing workspace or declared runtime
 * dependency (the check:licences guard, D-113).
 * @param {Record<string, object>} manifests - Root and workspace package.json files by path
 *   (productionSetGuard.readWorkspaceManifests).
 * @param {object[]} components - The kept npm components (productionPart).
 * @returns {string[]} Problems, then the likely cause; empty when the set is complete.
 */
export function incompleteNpmSet(manifests, components) {
  const packages = components.map((c) => ({ name: packageName(c['bom-ref']), location: c['bom-ref'] }));
  return incompleteSetProblems(expectedProductionPackages(manifests), packages);
}
