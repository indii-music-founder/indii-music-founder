import { describe, expect, it } from 'vitest';
import { TuneCoreStatementAdapter } from '../adapters/TuneCoreStatementAdapter';
import { TuneCoreStatementAdapter as SharedTuneCoreAdapter } from '@indii/shared';
import { LayeredValidator } from '../LayeredValidator';
import { canBookStatement } from '../statementBooking';

const header = 'Sales Period,Posted Date,Store Name,Country Of Sale,Artist,Release Title,Song Title,ISRC,UPC,Quantity,Total Earned';
const row = (quantity: string, earned = '12.34') =>
  `2026-03,2026-04-18,Spotify,US,QA Artist,QA Paper Moon,QA Paper Moon,US-QAT-26-99999,8847243739548,${quantity},${earned}`;

for (const [name, adapter] of [
  ['renderer', new TuneCoreStatementAdapter()],
  ['shared', new SharedTuneCoreAdapter()],
] as const) {
  describe(`${name} TuneCore quantity integrity`, () => {
    it.each(['banana', 'NOT_A_NUMBER', '', '12oops', '1.5', '1e3', 'Infinity', '9007199254740992', '--3'])(
      'quarantines invalid quantity %j and excludes its revenue', async (quantity) => {
        const report = adapter.parse(`${header}\n${row(quantity)}`);
        expect(report.transactions).toHaveLength(0);
        expect(report.quarantinedRows).toEqual([expect.objectContaining({ lineIndex: 2, errorCode: 'ERR_INVALID_NUMERIC' })]);
        expect(report.totalQuantity).toBe(0);
        expect(report.totalStreams).toBe(0);
        expect(report.totalGrossRevenue).toBe(0);
        expect(report.totalNetRevenue).toBe(0);
        const validation = await LayeredValidator.validate(`${header}\n${row(quantity)}`, report);
        expect(validation.humanReview.requiresArtistConfirmation).toBe(true);
        expect(canBookStatement(report, validation)).toBe(false);
      },
    );

    it.each(['0', '8200', '-12', '+12'])(
      'preserves complete integer quantity %s', async (quantity) => {
        const content = `${header}\n${row(quantity)}`;
        const report = adapter.parse(content);
        expect(report.quarantinedRows).toHaveLength(0);
        expect(report.transactions[0]?.quantity).toBe(Number(quantity));
        expect(report.totalQuantity).toBe(Number(quantity));
        expect(report.totalGrossRevenue).toBe(12.34);
        expect(canBookStatement(report, await LayeredValidator.validate(content, report))).toBe(true);
      },
    );

    it('blocks partial booking and preserves only the valid row totals', async () => {
      const content = `${header}\n${row('banana')}\n${row('5', '2.50')}`;
      const report = adapter.parse(content);
      expect(report.transactions).toHaveLength(1);
      expect(report.quarantinedRows).toHaveLength(1);
      expect(report.totalQuantity).toBe(5);
      expect(report.totalGrossRevenue).toBe(2.5);
      expect(canBookStatement(report, await LayeredValidator.validate(content, report))).toBe(false);
    });

    it('requires every validation gate and a nonempty statement before booking', async () => {
      const content = `${header}\n${row('5')}`;
      const report = adapter.parse(content);
      const validation = await LayeredValidator.validate(content, report);
      expect(canBookStatement(null, validation)).toBe(false);
      expect(canBookStatement(report, null)).toBe(false);
      expect(canBookStatement({ ...report, transactions: [] }, validation)).toBe(false);
      expect(canBookStatement(report, { ...validation, allPassed: false })).toBe(false);
      expect(canBookStatement(report, { ...validation, differential: { ...validation.differential, passed: false } })).toBe(false);
      expect(canBookStatement(report, { ...validation, humanReview: { ...validation.humanReview, requiresArtistConfirmation: true } })).toBe(false);
    });
  });
}
