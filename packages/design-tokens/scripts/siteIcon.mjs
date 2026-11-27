/**
 * siteIcon — the web app's browser-tab icon, drawn from the tokens: a rounded square in `primary-dark` with a play
 * triangle in `surface`, as an SVG and as a 32 × 32 picture in an .ico file.
 *
 * Why: a browser asks every site for `/favicon.ico`, and without one each visitor's first page logs a 404. HVL has
 *      not supplied its logo files, so the icon is a plain mark in HVL's colours, not the logo. Both files are
 *      generated, so their colours can only be tokens (UD-001), and from one drawing, so they cannot differ.
 * Spec: UD-001
 * Invariants:
 *   - The only colours are the tokens `primary-dark` and `surface` (10.82 : 1, a pairing the contrast test holds).
 *   - The same tokens give the same bytes on every machine and Node version: every sample point is a multiple of
 *     1/8, so the arithmetic is exact, and the picture is stored without compression, so no zlib version decides
 *     a byte.
 *   - The SVG holds shapes only: no script, link, image or outside reference.
 * Collaborators: ./buildSiteIcon.mjs (writes and checks the files), ./tokenModel.mjs,
 *   apps/web/src/app/icon.svg and favicon.ico (Next.js serves both and links them from every page).
 * Tests: packages/design-tokens/test/siteIcon.test.ts
 */
import { crc32 } from 'node:zlib';
import { colourHex } from './tokenModel.mjs';

/** Width and height of the drawing and of the .ico's picture, in pixels. */
export const ICON_SIZE = 32;
const CORNER_RADIUS = 6;
/** The play triangle, clockwise; its centre of mass is the icon's centre. */
const MARK = [
  [11.5, 8],
  [25, 16],
  [11.5, 24],
];
/** Samples per pixel side: 16 samples a pixel smooth the round corners and the slanted edges. */
const SAMPLES = 4;

const inField = (x, y) => {
  const nearestX = Math.min(Math.max(x, CORNER_RADIUS), ICON_SIZE - CORNER_RADIUS);
  const nearestY = Math.min(Math.max(y, CORNER_RADIUS), ICON_SIZE - CORNER_RADIUS);
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= CORNER_RADIUS ** 2;
};

const inMark = (x, y) =>
  MARK.every(([fromX, fromY], corner) => {
    const [toX, toY] = MARK[(corner + 1) % MARK.length];
    return (toX - fromX) * (y - fromY) - (toY - fromY) * (x - fromX) >= 0;
  });

const channels = (hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));

/** One row per line of pixels: a filter byte (0, none) and then red, green, blue and alpha of each pixel. */
function pixelRows(field, mark) {
  const rows = Buffer.alloc(ICON_SIZE * (1 + ICON_SIZE * 4));
  for (let y = 0; y < ICON_SIZE; y += 1) {
    for (let x = 0; x < ICON_SIZE; x += 1) {
      let [covered, marked] = [0, 0];
      for (let sample = 0; sample < SAMPLES * SAMPLES; sample += 1) {
        const sampleX = x + ((sample % SAMPLES) + 0.5) / SAMPLES;
        const sampleY = y + (Math.floor(sample / SAMPLES) + 0.5) / SAMPLES;
        if (!inField(sampleX, sampleY)) continue;
        covered += 1;
        if (inMark(sampleX, sampleY)) marked += 1;
      }
      const at = y * (1 + ICON_SIZE * 4) + 1 + x * 4;
      for (let channel = 0; channel < 3 && covered > 0; channel += 1) {
        rows[at + channel] = Math.round(
          (marked * mark[channel] + (covered - marked) * field[channel]) / covered,
        );
      }
      rows[at + 3] = Math.round((255 * covered) / (SAMPLES * SAMPLES));
    }
  }
  return rows;
}

const uint32 = (value) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value >>> 0);
  return bytes;
};

const pngChunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  return Buffer.concat([uint32(data.length), body, uint32(crc32(body))]);
};

/** A zlib stream that stores the bytes as they are: one stored block and its Adler-32 checksum. */
function storedZlib(data) {
  let [low, high] = [1, 0];
  for (const byte of data) {
    low = (low + byte) % 65521;
    high = (high + low) % 65521;
  }
  const block = Buffer.from([0x78, 0x01, 0x01, 0, 0, 0, 0]);
  block.writeUInt16LE(data.length, 3);
  block.writeUInt16LE(~data.length & 0xffff, 5);
  return Buffer.concat([block, data, uint32(high * 65536 + low)]);
}

function iconPng(field, mark) {
  const header = Buffer.concat([uint32(ICON_SIZE), uint32(ICON_SIZE), Buffer.from([8, 6, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', storedZlib(pixelRows(field, mark))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** An .ico with one picture: a 6-byte file header, one 16-byte directory entry, then the PNG. */
function iconIco(png) {
  const directory = Buffer.from([
    0,
    0,
    1,
    0,
    1,
    0,
    ICON_SIZE,
    ICON_SIZE,
    0,
    0,
    1,
    0,
    32,
    0,
    0,
    0,
    0,
    0,
    22,
    0,
    0,
    0,
  ]);
  directory.writeUInt32LE(png.length, 14);
  return Buffer.concat([directory, png]);
}

/**
 * The icon's files.
 * @param {object} tokens - Parsed tokens.json.
 * @returns {{'icon.svg': Buffer, 'favicon.ico': Buffer}} File name → bytes.
 * @throws {Error} When `primary-dark` or `surface` is not a colour token.
 */
export function iconFiles(tokens) {
  const [field, mark] = [colourHex(tokens, 'primary-dark'), colourHex(tokens, 'surface')];
  const path = `M${MARK.map((point) => point.join(' ')).join(' ')}z`;
  const svg = [
    '<!-- Generated from packages/design-tokens/tokens.json by `npm run tokens:build`. Do not edit. -->',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">`,
    `  <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="${CORNER_RADIUS}" fill="${field}"/>`,
    `  <path d="${path}" fill="${mark}"/>`,
    '</svg>',
    '',
  ].join('\n');
  return {
    'icon.svg': Buffer.from(svg, 'utf8'),
    'favicon.ico': iconIco(iconPng(channels(field), channels(mark))),
  };
}
