/**
 * videoSources — the video files and text tracks of an `H5P.InteractiveVideo` or `H5P.Video` node.
 *
 * Why: the two types store the same things in different places. InteractiveVideo keeps files in
 *      `interactiveVideo.video.files` and tracks in `interactiveVideo.video.textTracks.videoTrack`; H5P.Video keeps
 *      files in `sources` and tracks in `a11y` (a one-field group, which H5P stores as the list itself).
 * Spec: UD-021
 * Invariants:
 *   - A node with no video file has no video (`undefined`); rules then have nothing to check.
 *   - Track kinds are as stored; a missing kind is the player's default (subtitles).
 * Collaborators: ./rules/videoCaptionsRule.ts, ./rules/videoTranscriptRule.ts.
 * Tests: apps/server/test/validation/rules/videoCaptionsRule.test.ts
 */
import type { ContentNode } from './contentWalker.js';
import { pathOf } from './contentPath.js';
import { asArray, asString, fieldAt } from './paramReaders.js';

/** A text track (WebVTT file) of a video. */
export interface VideoTrack {
  /** `subtitles`, `captions`, `descriptions`, `chapters`, or `undefined` when not set. */
  readonly kind: string | undefined;
  /** The track file's path, or `''` when no file is uploaded. */
  readonly file: string;
}

/** The video of one node. */
export interface NodeVideo {
  /** Path of the files field (for findings about the video itself). */
  readonly filesPath: string;
  /** Each file's path or URL. */
  readonly files: readonly string[];
  /** Path of the text-track field. */
  readonly tracksPath: string;
  readonly tracks: readonly VideoTrack[];
}

const filePaths = (value: unknown): string[] =>
  asArray(value)
    .map((file) => asString(fieldAt(file, 'path')) ?? '')
    .filter((path) => path !== '');

const tracksOf = (value: unknown): VideoTrack[] =>
  asArray(value).map((track) => ({
    kind: asString(fieldAt(track, 'kind')),
    file: asString(fieldAt(track, 'track', 'path')) ?? '',
  }));

/**
 * The video files and tracks of a node.
 * @param node - A walked node.
 * @returns Its video, or `undefined` for other content types and for a video without files.
 */
export function videoOf(node: ContentNode): NodeVideo | undefined {
  const { params, path } = node;
  let video: NodeVideo | undefined;
  if (node.machineName === 'H5P.InteractiveVideo') {
    const base = ['interactiveVideo', 'video'] as const;
    video = {
      filesPath: pathOf(path, ...base, 'files'),
      files: filePaths(fieldAt(params, ...base, 'files')),
      tracksPath: pathOf(path, ...base, 'textTracks'),
      tracks: tracksOf(fieldAt(params, ...base, 'textTracks', 'videoTrack')),
    };
  } else if (node.machineName === 'H5P.Video') {
    video = {
      filesPath: pathOf(path, 'sources'),
      files: filePaths(fieldAt(params, 'sources')),
      tracksPath: pathOf(path, 'a11y'),
      tracks: tracksOf(fieldAt(params, 'a11y')),
    };
  }
  return video && video.files.length > 0 ? video : undefined;
}

/**
 * The origin of an absolute http(s) URL.
 * @param file - A file path or URL.
 * @returns e.g. `https://hvl.cloud.panopto.eu`, or `undefined` for a relative path or another scheme.
 */
export function originOf(file: string): string | undefined {
  if (!/^https?:\/\//i.test(file)) return undefined;
  try {
    return new URL(file).origin;
  } catch {
    return undefined;
  }
}
