/**
 * @example "agreement_"
 */
type AgreementId = `agreement_${string}`;

const isAgreementId = (candidate: string): candidate is AgreementId => {
    throw new Error("TODO: Implement me!");
};

describe("Agreement ID", () => {
    it("detects Agreement ID", () => {
        const correctExample = `agreement_44324591e3db454fbf09ef125ff1f102`;
        const actual = isAgreementId(correctExample);

        expect(actual).toBe(true);
    })
});
