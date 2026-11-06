/**
 * Tests that the pilot's issue forms, the chooser and the label list are valid for GitHub, that the checks catch the
 * mistakes GitHub would not report on push, and that the documents and links agree with the files.
 *
 * Spec: NFR-004
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { configProblems, formProblems, labelListProblems, readYaml } from '../issueFormRules.mjs';
import { FORMS, TEMPLATES, config, forms, labelNames, labels, read, root } from './issueFormFiles.mjs';

const ALL_FILES = [...FORMS, 'config.yml'].map((file) => `${TEMPLATES}/${file}`).concat('.github/labels.yml');

describe('[NFR-004] the issue forms, the chooser and the labels are valid for GitHub', () => {
  it('[NFR-004] the chooser holds the two forms and its config, and every file parses as YAML 1.1 cleanly', () => {
    expect(readdirSync(`${root}${TEMPLATES}`).sort()).toEqual(['config.yml', ...FORMS]);
    for (const path of ALL_FILES) expect(readYaml(read(path)).problems, path).toEqual([]);
  });

  it('[NFR-004] each form follows the form schema and uses only labels from .github/labels.yml', () => {
    for (const file of FORMS) expect(formProblems(forms[file], labelNames), file).toEqual([]);
    expect(configProblems(config)).toEqual([]);
    expect(labelListProblems(labels)).toEqual([]);
  });

  it('[NFR-004] the checks report mistakes that GitHub would not report on push', () => {
    // Arrange: a form, a label list and a config with one mistake of each kind.
    const form = {
      name: 'Feil',
      description: 'x',
      labels: ['bug'],
      body: [
        { type: 'markdown', id: 'intro', attributes: { value: 'x' } },
        { type: 'input', id: 'a b', attributes: { label: 'Eining' } },
        { type: 'input', id: 'device', attributes: { label: 'Eining' }, validations: { required: 'yes' } },
        { type: 'dropdown', id: 'device', attributes: { label: 'Alvor', options: ['None', 'None'] } },
        { type: 'picture', attributes: { label: 'Fil' } },
      ],
    };
    const badLabels = [
      { name: 'a', color: 4357, description: 'x' },
      { name: 'A', color: 'FFFFFF', description: 'x' },
    ];
    const badConfig = {
      blank_issues_enabled: 'no',
      contact_links: [{ name: 'x', url: 'http://x', about: 'y' }],
    };
    // Act
    const problems = formProblems(form, labelNames).join('\n');
    // Assert
    const expected = [
      'label "bug"',
      'markdown takes no id',
      'only letters',
      'duplicate label',
      'validations',
    ];
    for (const text of [...expected, 'duplicate id', 'distinct', '"None"', 'unknown field type']) {
      expect(problems).toContain(text);
    }
    expect(labelListProblems(badLabels).join('\n')).toMatch(/six hexadecimal[\s\S]*appears twice/);
    expect(configProblems(badConfig)).toHaveLength(2);
    expect(readYaml('color: 004357\ndone: no\n').value).toEqual({ color: 2287, done: false });
    expect(readYaml('a: 1\na: 2\n').problems).not.toEqual([]);
  });

  it('[NFR-004] the guide and the triage document name every label, and every link reaches this repository', () => {
    // Arrange
    const docs = ['docs/testing/rapportere-problem.md', 'docs/testing/labels-and-triage.md'];
    const links =
      ALL_FILES.map(read)
        .join('\n')
        .match(/https:\/\/github\.com\/[^\s)]+/g) ?? [];
    // Act and assert: every label named, one repository for every link, a file for every file link.
    for (const doc of docs) {
      for (const name of labelNames) expect(read(doc), `${doc}: ${name}`).toContain(`\`${name}\``);
    }
    expect(new Set(links.map((link) => link.split('/').slice(0, 5).join('/'))).size).toBe(1);
    for (const link of links) {
      const path = /\/blob\/HEAD\/(.+)$/.exec(link)?.[1];
      if (path) expect(existsSync(`${root}${path}`), link).toBe(true);
      else expect(link).toMatch(/\/security\/policy$/);
    }
    expect(existsSync(`${root}SECURITY.md`)).toBe(true);
    expect(config.contact_links[0].url).toMatch(/\/security\/policy$/);
  });

  it("[NFR-004] the guide's and the triage document's relative links reach files that exist", () => {
    for (const doc of [
      'docs/testing/rapportere-problem.md',
      'docs/testing/labels-and-triage.md',
      'SECURITY.md',
    ]) {
      const folder = doc.includes('/') ? doc.slice(0, doc.lastIndexOf('/') + 1) : '';
      for (const [, target] of read(doc).matchAll(/\]\((?!https?:|#)([^)#\s]+)/g)) {
        expect(existsSync(`${root}${folder}${target}`), `${doc} → ${target}`).toBe(true);
      }
    }
  });
});
