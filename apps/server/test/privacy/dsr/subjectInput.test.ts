/**
 * Unit tests for reading the data subject from standard input (DATA-008, D-108's amendment of 2026-11-04): the whole
 * input as UTF-8, a prompt only at a terminal, and a size limit that refuses without echoing the input.
 *
 * Spec: DATA-008, DATA-009
 */
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { DataSubjectInputError } from '../../../src/privacy/dsr/dataSubject.js';
import { MAX_SUBJECT_BYTES, readSubjectInput } from '../../../src/privacy/dsr/subjectInput.js';

/** A stream of the given chunks, marked as a terminal or not. */
const streamOf = (chunks: (string | Buffer)[], isTTY: boolean) =>
  Object.assign(Readable.from(chunks), { isTTY });

describe('[DATA-008] readSubjectInput', () => {
  it('[DATA-008] reads the input to its end as UTF-8, prompting only at a terminal', async () => {
    // Arrange
    const prompts: string[] = [];
    const prompt = (line: string) => void prompts.push(line);
    // Act
    const piped = await readSubjectInput(
      streamOf(['{"feideId":', Buffer.from('"åse@hvl.no"}')], false),
      prompt,
    );
    const typed = await readSubjectInput(streamOf(['{}'], true), prompt);
    // Assert
    expect([piped, typed]).toEqual(['{"feideId":"åse@hvl.no"}', '{}']);
    expect(prompts).toEqual(['Paste the data subject as one JSON object, then press Ctrl-D on a new line:']);
  });

  it('[DATA-008] refuses more than 64 KiB without echoing any of it', async () => {
    // Arrange
    const input = streamOf(['x'.repeat(MAX_SUBJECT_BYTES), 'kari@hvl.no'], false);
    // Act
    const read = readSubjectInput(input, () => undefined);
    // Assert
    await expect(read).rejects.toBeInstanceOf(DataSubjectInputError);
    await expect(read).rejects.toThrow(/^standard input is larger than 64 KiB$/);
  });
});
