/**
 * issueFormFiles — the pilot's real issue forms, chooser config and label list, parsed once for the tests.
 *
 * Why: both test files check the same committed files (D-101's amendment of 2026-11-05, problem reporting); one
 *      loader keeps their paths and their YAML reading in one place.
 * Spec: NFR-004
 * Invariants:
 *   - Reads only committed repository files, through ../issueFormRules.mjs's YAML 1.1 reader.
 * Collaborators: ../issueFormRules.mjs, .github/ISSUE_TEMPLATE/, .github/labels.yml.
 * Tests: tools/issue-forms/test/issueFormSyntax.test.mjs, tools/issue-forms/test/issueFormContent.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readYaml } from '../issueFormRules.mjs';

/** The repository root, with a trailing slash. */
export const root = fileURLToPath(new URL('../../../', import.meta.url));
/** Where GitHub looks for issue forms and the chooser's config. */
export const TEMPLATES = '.github/ISSUE_TEMPLATE';
/** The two forms: a fault and an accessibility barrier. */
export const FORMS = ['feil.yml', 'uu-barriere.yml'];

/**
 * Reads a repository file as UTF-8 text.
 * @param {string} path - Repository-relative path.
 * @returns {string} The file's text.
 */
export const read = (path) => readFileSync(`${root}${path}`, 'utf8');

/** Each form, parsed, by file name. */
export const forms = Object.fromEntries(
  FORMS.map((file) => [file, readYaml(read(`${TEMPLATES}/${file}`)).value]),
);
/** The chooser's config.yml, parsed. */
export const config = readYaml(read(`${TEMPLATES}/config.yml`)).value;
/** The label list, parsed. */
export const labels = readYaml(read('.github/labels.yml')).value;
/** The label names of the list. */
export const labelNames = new Set(labels.map((label) => label.name));

/**
 * Finds a form's field by its id.
 * @param {string} file - The form's file name.
 * @param {string} id - The field's id.
 * @returns {Record<string, any> | undefined} The field, or undefined.
 */
export const fieldOf = (file, id) => forms[file].body.find((field) => field.id === id);

/**
 * The choices of a form's dropdown or checkbox field.
 * @param {string} file - The form's file name.
 * @param {string} id - The field's id.
 * @returns {unknown[]} Its options.
 */
export const optionsOf = (file, id) => fieldOf(file, id).attributes.options;
