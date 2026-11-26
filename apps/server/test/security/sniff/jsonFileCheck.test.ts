/**
 * Tests of the check of a `.json` file read in portions (D-143): the same answers as decoding and parsing the
 * whole file, also where a character, a string, a number or an escape lies across two portions, and a large file
 * checked by a process whose memory would not hold the parsed file.
 *
 * Spec: SEC-002
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { isJsonFile, JSON_PORTION } from '../../../src/security/sniff/jsonFileCheck.js';

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = mkdtempSync(join(tmpdir(), 'json-check-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

const place = (data: Buffer | string): string => {
  const path = join(dir, `${(counter += 1)}.json`);
  writeFileSync(path, data);
  return path;
};

/** What the check did before: the whole file decoded as UTF-8 (one BOM removed) and parsed. */
const parsesWhole = (data: Buffer): boolean => {
  try {
    JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(data));
    return true;
  } catch {
    return false;
  }
};

/** A JSON string value whose `tail` starts `before` bytes ahead of the end of the first portion. */
const acrossPortions = (tail: string, before: number): Buffer =>
  Buffer.from(`["${'a'.repeat(JSON_PORTION - 2 - before)}${tail}`, 'utf8');

describe('[SEC-002] a .json file checked in portions', () => {
  it('[SEC-002] answers as decoding and parsing the whole file did', async () => {
    // Arrange
    const files: Buffer[] = [
      Buffer.from('{"title":"Oppgåve","items":[1,2]}'),
      Buffer.concat([BOM, Buffer.from('[1]')]),
      Buffer.concat([BOM, BOM, Buffer.from('[1]')]),
      Buffer.concat([Buffer.from('[1]'), BOM]),
      BOM,
      Buffer.alloc(0),
      Buffer.from('  \n'),
      Buffer.from('{"a":'),
      Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]),
      Buffer.from([0x22, 0xc3, 0x22]),
      Buffer.from([0x22, 0xed, 0xa0, 0x80, 0x22]),
      Buffer.from([0x22, 0xc0, 0xaf, 0x22]),
      Buffer.from('"😀"'),
      Buffer.from('{"a":1}', 'utf16le'),
    ];
    // Act
    const answers = await Promise.all(files.map((data) => isJsonFile(place(data))));
    // Assert
    expect(answers).toEqual(files.map(parsesWhole));
    expect(answers.slice(0, 5)).toEqual([true, true, false, false, false]);
  });

  it('[SEC-002] reads a character, an escape, a number or a word that lies across two portions', async () => {
    // Arrange: each tail starts just before the end of the first portion
    const files = [
      acrossPortions('å"]', 1),
      acrossPortions('😀"]', 2),
      acrossPortions('\\u00e5"]', 3),
      acrossPortions('\\n"]', 1),
      acrossPortions('",-12.5e+3]', 5),
      acrossPortions('",true,null]', 4),
      acrossPortions('",{"k":[]}]', 3),
      acrossPortions('\\u00"]', 3),
      acrossPortions('",tru e]', 4),
      acrossPortions('",1.]', 3),
      Buffer.concat([acrossPortions('', 0), Buffer.from([0xc3])]),
      Buffer.from(`[${'1,'.repeat(JSON_PORTION * 3)}1]`),
      Buffer.from(`[${'1,'.repeat(JSON_PORTION * 3)}]`),
    ];
    // Act
    const answers = await Promise.all(files.map((data) => isJsonFile(place(data))));
    // Assert
    expect(answers).toEqual(files.map(parsesWhole));
    expect(answers).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it('[SEC-002] a file that cannot be read is not JSON', async () => {
    // Arrange
    const folder = join(dir, 'folder.json');
    mkdirSync(folder);
    // Act and assert
    expect(await isJsonFile(join(dir, 'missing.json'))).toBe(false);
    expect(await isJsonFile(folder)).toBe(false);
  });

  it('[SEC-002] a 30 MB file is checked by a process with too little memory to hold it parsed', () => {
    // Arrange: three million small objects, and a process whose heap is limited to 64 MB
    const large = place(
      `[${'{"a":1,"b":"x"},'.repeat(1_900_000)}{"deep":${'['.repeat(400_000)}${']'.repeat(400_000)}}]`,
    );
    const broken = place(`[${'{"a":1,"b":"x"},'.repeat(1_900_000)}]`);
    const script = `
      import { matchesTextFormat } from './src/security/sniff/textFormats.ts';
      const answers = [];
      for (const path of process.argv.slice(1)) answers.push(await matchesTextFormat(path, 'json', undefined));
      console.log(JSON.stringify(answers));
    `;
    // Act
    const child = spawnSync(
      process.execPath,
      ['--max-old-space-size=64', '--import', 'tsx', '--input-type=module', '-e', script, large, broken],
      { cwd: SERVER_DIR, env: { PATH: process.env.PATH ?? '' }, encoding: 'utf8', timeout: 120_000 },
    );
    // Assert
    expect([child.status, child.stdout.trim()]).toEqual([0, '[true,false]']);
  }, 150_000);
});
