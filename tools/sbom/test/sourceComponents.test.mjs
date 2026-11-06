/**
 * Tests for the components npm cannot see: H5P core, editor and the ten content types from their pin files, and the
 * container images from the deployment files, each with its pin.
 *
 * Spec: SEC-007
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CORE_SCRIPT,
  LIBRARY_MANIFEST,
  contentTypeComponents,
  coreComponents,
  shellAssignments,
} from '../h5pComponents.mjs';
import {
  COMPOSE_FILE,
  DOCKERFILE,
  dockerfileImages,
  parseImageReference,
  scannerImage,
} from '../imageComponents.mjs';
import { REPOSITORY } from './sbomFixtures.mjs';

const readText = (file) => readFileSync(join(REPOSITORY, file), 'utf8');
const commitOf = (component) => component.pedigree.commits[0].uid;
const property = (component, name) => component.properties.find((p) => p.name === name)?.value;
const DIGEST = 'a'.repeat(64);

describe('[SEC-007] H5P components', () => {
  it('[SEC-007] lists H5P core at tag 1.28.0 and the editor at the commits fetchCoreClients.sh proves', () => {
    // Arrange
    const core = '2aeb0b83fa603e331381b3a6b8bf42c3773ba140';
    const editor = 'ab2daa18bd61b19e7f8729e22eec88f3b637a868';
    // Act
    const [coreComponent, editorComponent] = coreComponents(readText);
    // Assert
    expect(coreComponent).toMatchObject({ name: 'h5p-php-library', version: '1.28.0' });
    expect(coreComponent.purl).toBe(`pkg:github/h5p/h5p-php-library@${core}`);
    expect(property(coreComponent, 'hvl:git:ref')).toBe('refs/tags/1.28.0');
    expect(property(coreComponent, 'hvl:file-count')).toBe('67');
    expect(editorComponent.purl).toBe(`pkg:github/h5p/h5p-editor-php-library@${editor}`);
    expect(commitOf(editorComponent)).toBe(editor);
    expect(property(editorComponent, 'hvl:file-count')).toBe('214');
  });

  it('[SEC-007] lists the ten content types at the commits libraries.manifest.json pins, never DragQuestion', () => {
    // Arrange
    const manifest = JSON.parse(readText(LIBRARY_MANIFEST));
    // Act
    const types = contentTypeComponents(manifest);
    // Assert
    expect(types.map((t) => t.name)).toEqual([
      'H5P.CoursePresentation',
      'H5P.InteractiveVideo',
      'H5P.QuestionSet',
      'H5P.InteractiveBook',
      'H5P.Column',
      'H5P.DragText',
      'H5P.MultiChoice',
      'H5P.Blanks',
      'H5P.ImageHotspots',
      'H5P.BranchingScenario',
    ]);
    for (const type of types) {
      const entry = manifest.libraries.find((l) => l.machineName === type.name && l.version === type.version);
      expect(commitOf(type)).toBe(entry.commit);
      expect(type.purl.endsWith(`@${entry.commit}`)).toBe(true);
      expect(type.externalReferences).toEqual([{ type: 'vcs', url: entry.repository }]);
      expect(property(type, 'hvl:git:ref')).toBe(entry.ref);
    }
  });

  it('[SEC-007] stops when a pin is missing instead of guessing one', () => {
    const script = readText(CORE_SCRIPT).replace(/^CORE_COMMIT=.*$/m, '');
    expect(() => coreComponents((file) => (file === CORE_SCRIPT ? script : readText(file)))).toThrow(
      /CORE_COMMIT="…" not found/,
    );
    expect(() => contentTypeComponents({ libraries: [] })).toThrow(
      /0 entries for H5P.CoursePresentation 1\.28\.x/,
    );
  });

  it('[SEC-007] resolves $ROOT and earlier names in the fetch script', () => {
    const values = shellAssignments('REF="$ROOT/docs/ref"\nLIST="$REF/a.sha256"\nTAG="1.28.0"\n');
    expect(values.get('LIST')).toBe('docs/ref/a.sha256');
    expect(values.get('TAG')).toBe('1.28.0');
  });
});

describe('[SEC-007] container image components', () => {
  it('[SEC-007] lists every image the Dockerfile builds from, by the digest its FROM line pins', () => {
    // Arrange
    const text = readText(DOCKERFILE);
    const pinned = [...text.matchAll(/^FROM \S+@sha256:([0-9a-f]{64})/gm)].map((m) => m[1]);
    // Act
    const images = dockerfileImages(text);
    // Assert
    expect(pinned.length).toBeGreaterThan(0);
    expect(images.map((i) => i.hashes[0].content)).toEqual(pinned);
    const ubuntu = images.find((i) => i.name === 'ubuntu');
    expect(ubuntu.purl).toBe(
      `pkg:oci/ubuntu@sha256%3A${ubuntu.hashes[0].content}?repository_url=docker.io/library/ubuntu&tag=24.04`,
    );
    expect(property(ubuntu, 'hvl:dockerfile:stage')).toBe('base');
    expect(images.every((i) => i.type === 'container' && i.scope === 'required')).toBe(true);
  });

  it('[SEC-007] lists the ClamAV image of the local stack by digest, outside the server image', () => {
    const text = readText(COMPOSE_FILE);
    const digest = /clamav\/clamav:[\w.]+@sha256:([0-9a-f]{64})/.exec(text)[1];
    expect(scannerImage(text)).toMatchObject({ name: 'clamav/clamav', scope: 'excluded' });
    expect(scannerImage(text).hashes).toEqual([{ alg: 'SHA-256', content: digest }]);
  });

  it('[SEC-007] refuses an image pinned only by tag, and skips scratch and earlier stages', () => {
    // Arrange
    const dockerfile = `FROM ubuntu@sha256:${DIGEST} AS base\nFROM base AS build\nFROM scratch AS empty\n`;
    // Act and assert
    expect(dockerfileImages(dockerfile).map((i) => i.version)).toEqual([`sha256:${DIGEST}`]);
    expect(() => dockerfileImages('FROM ubuntu:24.04 AS base\n')).toThrow(/not pinned by a sha256 digest/);
    expect(() => scannerImage('services:\n  clamav:\n    image: clamav/clamav:1.4\n')).toThrow(/sha256/);
    expect(() => scannerImage('services: {}\n')).toThrow(/no image for service clamav/);
  });

  it('[SEC-007] reads registries, Docker Hub namespaces and official images apart', () => {
    expect(parseImageReference(`ghcr.io/org/tool:1.2@sha256:${DIGEST}`)).toMatchObject({
      registry: 'ghcr.io',
      path: 'org/tool',
      tag: '1.2',
    });
    expect(parseImageReference(`clamav/clamav:1.4@sha256:${DIGEST}`).path).toBe('clamav/clamav');
    expect(parseImageReference(`node:24-bookworm-slim@sha256:${DIGEST}`).path).toBe('library/node');
  });
});
