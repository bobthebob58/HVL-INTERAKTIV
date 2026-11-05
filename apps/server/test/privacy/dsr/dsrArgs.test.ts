/**
 * Unit tests for the data-subject CLI's arguments (DATA-008, D-108's amendment of 2026-11-04): `export|erase`,
 * `--operator`, and `--confirm` only after `erase`; the person is never an argument.
 *
 * Spec: DATA-008
 */
import { describe, expect, it } from 'vitest';
import { parseDsrArgs } from '../../../src/privacy/dsr/dsrCli.js';

const OP = 'admin@hvl.no';

describe('[DATA-008] parseDsrArgs', () => {
  it.each([
    [['export', '--operator', OP], { action: 'export', operatorFeideId: OP, confirm: false }],
    [['export', `--operator=${OP}`], { action: 'export', operatorFeideId: OP, confirm: false }],
    [['erase', '--operator', OP], { action: 'erase', operatorFeideId: OP, confirm: false }],
    [['erase', '--confirm', '--operator', OP], { action: 'erase', operatorFeideId: OP, confirm: true }],
  ])('[DATA-008] reads %j', (argv, expected) => {
    // Act and assert
    expect(parseDsrArgs(argv)).toEqual(expected);
  });

  it.each([
    [[]],
    [['export']],
    [['--operator', OP, 'export']],
    [['export', '--operator']],
    [['export', '--operator', '--confirm']],
    [['export', '--operator', OP, '--confirm']],
    [['erase', '--operator', OP, '--confirm', '--confirm']],
    [['erase', '--operator', OP, '--operator', OP]],
    [['erase', '--operator', OP, '--feide-id', 'kari@hvl.no']],
    [['export', '--operator', OP, 'kari@hvl.no']],
  ])('[DATA-008] refuses %j', (argv) => {
    // Act and assert
    expect(parseDsrArgs(argv)).toBeUndefined();
  });
});
