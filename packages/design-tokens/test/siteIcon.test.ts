/**
 * Tests for the browser-tab icon the tokens generate: its only colours are two tokens, the committed files are
 * what the generator writes, `--check` notices drift, and the .ico holds one readable 32 × 32 picture.
 *
 * Spec: UD-001
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ICON_DIR, main } from '../scripts/buildSiteIcon.mjs';
import { ICON_SIZE, iconFiles } from '../scripts/siteIcon.mjs';
import { colourHex, readTokens } from '../scripts/tokenModel.mjs';

const temporaryDirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'hvl-icon-'));
  temporaryDirs.push(dir);
  return dir;
};

/** The pixel at (x, y) of the .ico's picture, as `#RRGGBB` and its alpha. */
function pixelOf(ico: Buffer, x: number, y: number): { colour: string; alpha: number } {
  const png = ico.subarray(ico.readUInt32LE(18));
  // WHY: IHDR is 25 bytes after the 8-byte signature; the one IDAT chunk's data starts 8 bytes into it.
  const idat = png.subarray(8 + 25 + 8, png.length - 12 - 4);
  const rows = inflateSync(idat);
  const at = y * (1 + ICON_SIZE * 4) + 1 + x * 4;
  const hex = [...rows.subarray(at, at + 3)].map((channel) => channel.toString(16).padStart(2, '0'));
  return { colour: `#${hex.join('').toUpperCase()}`, alpha: rows[at + 3] ?? -1 };
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('the browser-tab icon', () => {
  it('[UD-001] the drawing names two colours, the tokens primary-dark and surface, and no other', () => {
    // Arrange
    const tokens = readTokens();
    // Act
    const svg = iconFiles(tokens)['icon.svg'].toString('utf8');
    // Assert
    expect([...new Set(svg.match(/#[0-9A-Fa-f]{6}/g))]).toEqual([
      colourHex(tokens, 'primary-dark'),
      colourHex(tokens, 'surface'),
    ]);
    expect(svg).not.toMatch(/<(?:script|image|use|foreignObject|a)\b|href=|url\(/);
  });

  it('[UD-001] the .ico holds one 32 × 32 picture: clear corners, a primary-dark field, a surface mark', () => {
    // Arrange
    const tokens = readTokens();
    // Act
    const ico = iconFiles(tokens)['favicon.ico'];
    // Assert: one picture, 32 × 32, 32 bits, a PNG that starts where the directory says
    expect([...ico.subarray(0, 8)]).toEqual([0, 0, 1, 0, 1, 0, ICON_SIZE, ICON_SIZE]);
    expect(ico.readUInt16LE(12)).toBe(32);
    expect(ico.readUInt32LE(14)).toBe(ico.length - 22);
    expect(ico.subarray(22, 30).toString('latin1')).toBe('\x89PNG\r\n\x1a\n');
    expect(pixelOf(ico, 0, 0).alpha).toBe(0);
    expect(pixelOf(ico, 4, 16)).toEqual({ colour: colourHex(tokens, 'primary-dark'), alpha: 255 });
    expect(pixelOf(ico, 16, 16)).toEqual({ colour: colourHex(tokens, 'surface'), alpha: 255 });
  });

  it('[UD-001] writes the same bytes every time, and other bytes when a token changes', () => {
    // Arrange
    const tokens = readTokens() as { color: Record<string, { value?: string }> };
    const changed = structuredClone(tokens);
    changed.color['primary-dark'] = { value: '#123456' };
    // Act
    const [first, second, other] = [iconFiles(tokens), iconFiles(tokens), iconFiles(changed)];
    // Assert
    expect(first).toEqual(second);
    expect(other['icon.svg'].toString('utf8')).toContain('#123456');
    expect(pixelOf(other['favicon.ico'], 4, 16).colour).toBe('#123456');
  });

  it('[UD-001] the committed icon files are what the generator writes', () => {
    // Arrange
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    // Act
    const code = main(['--check']);
    // Assert
    expect(code).toBe(0);
    expect(log.mock.calls.flat().join('\n')).toMatch(/2 files up to date/);
    expect(readFileSync(join(ICON_DIR, 'favicon.ico'))).toEqual(iconFiles(readTokens())['favicon.ico']);
  });

  it('[UD-001] --check names a missing or changed file and writes nothing', () => {
    // Arrange
    const dir = tempDir();
    writeFileSync(join(dir, 'icon.svg'), '<svg/>');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Act
    const code = main(['--check', `--out=${dir}`]);
    // Assert
    expect(code).toBe(1);
    expect(error.mock.calls.flat().join('\n')).toMatch(
      /icon\.svg is out of date[\s\S]*favicon\.ico is out of date/,
    );
    expect(readFileSync(join(dir, 'icon.svg'), 'utf8')).toBe('<svg/>');
  });

  it('[UD-001] a colour that is not a token is refused before any file is written', () => {
    // Arrange
    const dir = tempDir();
    const file = join(dir, 'tokens.json');
    writeFileSync(file, JSON.stringify({ color: { surface: { value: '#FFFFFF' } } }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Act
    const code = main([`--out=${dir}`, `--tokens=${file}`]);
    // Assert
    expect(code).toBe(1);
    expect(error.mock.calls.flat().join('\n')).toMatch(/unknown colour token: primary-dark/);
    expect(() => readFileSync(join(dir, 'icon.svg'))).toThrow();
  });
});
