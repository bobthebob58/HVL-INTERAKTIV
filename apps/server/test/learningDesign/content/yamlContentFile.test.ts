/**
 * Tests for reading a YAML content file: every problem with its file, line and key; repeated keys at any depth;
 * aliases and `__proto__` refused; frozen values at every depth; and the two ways a problem is written out.
 *
 * Spec: PED-001
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  contentDisplayPath,
  formatContentProblem,
  formatKeyedContentProblem,
  REPOSITORY_ROOT,
} from '../../../src/learningDesign/content/contentProblem.js';
import { deepFreeze } from '../../../src/learningDesign/content/deepFreeze.js';
import {
  parseYamlContent,
  readYamlContentFile,
} from '../../../src/learningDesign/content/yamlContentFile.js';

const FILE = 'content/example.yaml';
const schema = z.strictObject({
  title: z.string(),
  items: z.array(z.strictObject({ key: z.string(), size: z.int().min(1) })),
  nested: z.strictObject({ inner: z.strictObject({ a: z.string(), b: z.string() }) }).optional(),
});

const problemsOf = (yaml: string) => {
  const result = parseYamlContent(yaml, schema, FILE);
  if (result.ok) throw new Error('expected problems');
  return result.problems;
};

describe('[PED-001] YAML content files', () => {
  it('[PED-001] returns the value, frozen at every depth', () => {
    // Act
    const result = parseYamlContent('title: Tittel\nitems:\n  - key: a\n    size: 2\n', schema, FILE);
    // Assert
    expect(result).toEqual({ ok: true, value: { title: 'Tittel', items: [{ key: 'a', size: 2 }] } });
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.items[0])).toBe(true);
  });

  it('[PED-001] freezes the inside of a section value that is already frozen at the top', () => {
    // Arrange
    const section = Object.freeze({ list: [{ name: 'a' }] });
    // Act
    const content = deepFreeze({ section, shared: section });
    // Assert
    expect(Object.isFrozen(content.section.list)).toBe(true);
    expect(Object.isFrozen(content.section.list[0])).toBe(true);
  });

  it('[PED-001] refuses the key __proto__, which a record of named entries would drop silently', () => {
    // Arrange
    const records = z.strictObject({ refs: z.record(z.string(), z.string()) });
    const yaml = 'refs:\n  a1: T\n  __proto__: U\n';
    // Act
    const result = parseYamlContent(yaml, records, FILE);
    // Assert
    expect(result).toEqual({
      ok: false,
      problems: [{ file: FILE, line: 3, key: 'refs.__proto__', message: 'is not allowed as a key' }],
    });
  });

  it('[PED-001] reports a repeated key at any depth, at its second line', () => {
    // Arrange
    const yaml = ['title: T', 'items: []', 'nested:', '  inner:', '    a: x', '    b: y', '    a: z'].join(
      '\n',
    );
    // Act
    const problems = problemsOf(yaml);
    // Assert
    expect(problems).toEqual([
      { file: FILE, line: 7, key: 'nested.inner.a', message: 'appears more than once' },
    ]);
  });

  it('[PED-001] names a list item by its key, and a missing key by the line of the key above it', () => {
    // Arrange
    const yaml = ['title: T', 'items:', '  - key: forarbeid', '    size: 0', '  - key: underveis'].join('\n');
    // Act
    const problems = problemsOf(yaml);
    // Assert
    expect(problems).toEqual([
      expect.objectContaining({ line: 4, key: 'items[forarbeid].size' }),
      { file: FILE, line: 5, key: 'items[underveis].size', message: 'is missing' },
    ]);
  });

  it('[PED-001] numbers a list item without a key from 1', () => {
    expect(problemsOf('title: T\nitems:\n  - size: 3\n')).toEqual([
      { file: FILE, line: 3, key: 'items[#1].key', message: 'is missing' },
    ]);
  });

  it('[PED-001] reports an unknown key at its own line and a missing top-level key without a line', () => {
    // Act
    const problems = problemsOf('items: []\ncolour: blue\n');
    // Assert
    expect(problems).toEqual([
      { file: FILE, line: undefined, key: 'title', message: 'is missing' },
      { file: FILE, line: 2, key: 'colour', message: 'is not a known key (check the spelling)' },
    ]);
  });

  it('[PED-001] refuses an alias without building the data', () => {
    // Arrange
    const yaml = 'title: &t Tittel\nitems:\n  - key: *t\n    size: 1\n';
    // Act
    const problems = problemsOf(yaml);
    // Assert
    expect(problems).toEqual([
      {
        file: FILE,
        line: 3,
        key: 'items[#1].key',
        message: 'uses the alias *t; write the value out instead',
      },
    ]);
  });

  it('[PED-001] reports a syntax error with its line, and an empty value as empty', () => {
    expect(problemsOf('title: T\nitems: [\n')).toEqual([
      expect.objectContaining({ line: 3, message: expect.stringMatching(/^YAML syntax: .*\]$/) }),
    ]);
    expect(problemsOf('title:\nitems: []\n')).toEqual([
      { file: FILE, line: 1, key: 'title', message: 'is empty' },
    ]);
  });

  it('[PED-001] reports an unreadable file by its repository path and error code', () => {
    // Act
    const result = readYamlContentFile(join(REPOSITORY_ROOT, 'content', 'no-such-file.yaml'), schema);
    // Assert
    expect(result).toEqual({
      ok: false,
      problems: [{ file: 'content/no-such-file.yaml', message: 'cannot read the file (ENOENT)' }],
    });
  });

  it('[PED-001] shows a repository file relative to the root and any other file absolute', () => {
    expect(contentDisplayPath(join(REPOSITORY_ROOT, 'content', 'laeringsdesign', 'phases.yaml'))).toBe(
      'content/laeringsdesign/phases.yaml',
    );
    expect(contentDisplayPath('/tmp/elsewhere.yaml')).toBe('/tmp/elsewhere.yaml');
  });

  it('[PED-001] writes a problem with the file first, or with the key first under a header naming the file', () => {
    // Arrange
    const problem = { file: FILE, line: 4, key: 'items[a].size', message: 'is missing' };
    // Act and assert
    expect(formatContentProblem(problem)).toBe('content/example.yaml:4: items[a].size: is missing');
    expect(formatContentProblem({ file: FILE, message: 'is empty' })).toBe('content/example.yaml: is empty');
    expect(formatKeyedContentProblem(problem)).toBe('items[a].size: is missing (line 4)');
    expect(formatKeyedContentProblem({ file: FILE, message: 'YAML syntax: x' })).toBe('YAML syntax: x');
  });
});
