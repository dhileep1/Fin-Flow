const { generateSchedule } = require('../src/services/loan.service');

describe('Loan Service - generateSchedule', () => {
    it('should correctly generate loan due schedule with rounding adjustments in the final installment', () => {
        const principal = 10000;
        const tenure = 3;
        const rate = 0.01; // 1%
        const startDate = new Date('2026-07-12T00:00:00.000Z');

        const { monthlyPrincipal, monthlyInterest, dues } = generateSchedule(principal, tenure, rate, startDate);

        expect(monthlyPrincipal).toBe(3333.33); // 10000 / 3 rounded
        expect(monthlyInterest).toBe(100);     // 10000 * 0.01
        expect(dues.length).toBe(3);

        // Sequence 1
        expect(dues[0].dueSequence).toBe(1);
        expect(dues[0].principalDue).toBe(3333.33);
        expect(dues[0].interestDue).toBe(100);
        expect(dues[0].totalDue).toBe(3433.33);

        // Sequence 2
        expect(dues[1].dueSequence).toBe(2);
        expect(dues[1].principalDue).toBe(3333.33);
        expect(dues[1].interestDue).toBe(100);
        expect(dues[1].totalDue).toBe(3433.33);

        // Sequence 3 (Final installment absorbs rounding remainder)
        // Remainder: 10000 - (3333.33 * 2) = 10000 - 6666.66 = 3333.34
        expect(dues[2].dueSequence).toBe(3);
        expect(dues[2].principalDue).toBe(3333.34);
        expect(dues[2].interestDue).toBe(100);
        expect(dues[2].totalDue).toBe(3433.34);
    });
});
