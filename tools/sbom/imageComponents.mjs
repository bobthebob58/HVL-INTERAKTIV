/**
 * imageComponents — the container images the deployment files pin by digest, as SBOM components: the Dockerfile's
 * base images and the ClamAV image of the local stack.
 *
 * Why: the server image is built on images npm knows nothing about, and HVL IT needs their exact digests to check
 *      them against advisories (SEC-007). The ClamAV image is listed too, marked as not part of the server, because
 *      the local stack and CI scan with it (D-110).
 * Spec: SEC-007
 * Invariants:
 *   - Every `FROM` that names an image (not `scratch`, not an earlier stage) becomes one component; a `FROM` without
 *     a sha256 digest throws instead of being listed by tag (deploy-check refuses it too).
 *   - The ClamAV component is the `clamav` service's image in deploy/compose.app.yml, by digest, with scope
 *     `excluded`: it is not in the server image. In production the server uses the clamd that `CLAMAV_HOST` names,
 *     which the operator runs; without it the server starts only with `CLAMAV_ALLOW_UNSCANNED_UPLOADS=true`
 *     (apps/server/src/config/env.ts).
 *   - The digest is the component's purl version and its SHA-256 hash; the tag is its `version`.
 * Collaborators: ../deploy-check/deployRules.mjs (dockerInstructions), deploy/Dockerfile, deploy/compose.app.yml,
 *   yaml, ./buildSbom.mjs.
 * Tests: tools/sbom/test/sourceComponents.test.mjs
 */
import { parse } from 'yaml';
import { dockerInstructions } from '../deploy-check/deployRules.mjs';
import { SOURCE_PROPERTY } from './h5pComponents.mjs';

/** The server image's Dockerfile. */
export const DOCKERFILE = 'deploy/Dockerfile';
/** The local stack whose ClamAV service is listed. */
export const COMPOSE_FILE = 'deploy/compose.app.yml';
/** The scanner's service name in COMPOSE_FILE. */
export const SCANNER_SERVICE = 'clamav';

// WHY: what each stage is for, from the Dockerfile itself (lines 20-27); a stage not named here gets a plain line.
const STAGE_ROLES = {
  base: 'Base image of the server image: the build stages and the runtime stage start from it',
  node:
    'Node.js for the server image: only /usr/local/bin/node and /usr/local/lib/node_modules (npm) are copied ' +
    'from it',
};

/**
 * Splits an image reference pinned by digest.
 * @param {string} reference - For example `ubuntu:24.04@sha256:<64 hex>` or `clamav/clamav:1.4@sha256:<64 hex>`.
 * @returns {{registry: string, path: string, name: string, tag: string, digest: string}} Docker Hub names get
 *   `docker.io` and, for official images, `library/`.
 * @throws {Error} When the reference has no sha256 digest.
 */
export function parseImageReference(reference) {
  const m = /^([a-z0-9][a-z0-9._:/-]*?)(?::([\w][\w.-]*))?@sha256:([0-9a-f]{64})$/.exec(reference);
  if (!m) throw new Error(`image ${reference} is not pinned by a sha256 digest`);
  const [, written, tag = '', digest] = m;
  const parts = written.split('/');
  const hasRegistry = parts.length > 1 && /[.:]|^localhost$/.test(parts[0]);
  const registry = hasRegistry ? parts.shift() : 'docker.io';
  if (!hasRegistry && parts.length === 1) parts.unshift('library');
  return { registry, path: parts.join('/'), name: written, tag, digest };
}

/**
 * Builds one container component.
 * @param {string} reference - The image reference as the file writes it.
 * @param {{description: string, scope: string, properties: {name: string, value: string}[]}} about - What it is.
 * @returns {object} The CycloneDX component; `bom-ref` is its purl (`pkg:oci/…`).
 */
export function imageComponent(reference, { description, scope, properties }) {
  const { registry, path, name, tag, digest } = parseImageReference(reference);
  const tagQualifier = tag ? `&tag=${tag}` : '';
  const purl = `pkg:oci/${path.split('/').at(-1)}@sha256%3A${digest}?repository_url=${registry}/${path}${tagQualifier}`;
  return {
    'bom-ref': purl,
    type: 'container',
    name,
    version: tag || `sha256:${digest}`,
    scope,
    description,
    purl,
    properties,
    hashes: [{ alg: 'SHA-256', content: digest }],
  };
}

/**
 * The images the Dockerfile's `FROM` lines name.
 * @param {string} text - deploy/Dockerfile.
 * @returns {object[]} One component per external image, in file order.
 * @throws {Error} When an image is not pinned by digest.
 */
export function dockerfileImages(text) {
  const stages = new Set();
  const images = [];
  for (const { text: instruction } of dockerInstructions(text)) {
    const words = instruction.split(/\s+/).filter((w) => !w.startsWith('--'));
    if (!/^FROM$/i.test(words[0] ?? '')) continue;
    const [, image, as, alias] = words;
    const stage = /^AS$/i.test(as ?? '') ? alias : '';
    if (image !== 'scratch' && !stages.has(image))
      images.push(
        imageComponent(image, {
          description: STAGE_ROLES[stage] ?? `Image of the Dockerfile stage "${stage}"`,
          scope: 'required',
          properties: [
            { name: 'hvl:dockerfile:stage', value: stage },
            { name: SOURCE_PROPERTY, value: DOCKERFILE },
          ],
        }),
      );
    if (stage) stages.add(stage);
  }
  return images;
}

/**
 * The ClamAV image of the local stack.
 * @param {string} text - deploy/compose.app.yml.
 * @returns {object} The component, scope `excluded`.
 * @throws {Error} When the service is missing or its image is not pinned by digest.
 */
export function scannerImage(text) {
  const image = parse(text)?.services?.[SCANNER_SERVICE]?.image;
  if (typeof image !== 'string') throw new Error(`${COMPOSE_FILE}: no image for service ${SCANNER_SERVICE}`);
  return imageComponent(image, {
    description:
      'Malware scanner of the local stack and CI; not part of the server image (in production the server uses ' +
      'the clamd that CLAMAV_HOST names, run by the operator)',
    scope: 'excluded',
    properties: [
      { name: 'hvl:compose:service', value: SCANNER_SERVICE },
      { name: SOURCE_PROPERTY, value: COMPOSE_FILE },
    ],
  });
}
