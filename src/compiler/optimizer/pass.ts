import type { IRInstr, PassReport } from '../types';

export interface PassOutput {
  ir: IRInstr[];
  report: PassReport;
}
export type Pass = (ir: IRInstr[]) => PassOutput;

export function report(
  pass: string,
  before: IRInstr[],
  after: IRInstr[],
  notes: string[],
): PassOutput {
  return {
    ir: after,
    report: { pass, changed: notes.length > 0, before: before.length, after: after.length, notes },
  };
}

export const hasLoop = (ir: IRInstr[]) => ir.some((i) => i.op === 'LOOP');
