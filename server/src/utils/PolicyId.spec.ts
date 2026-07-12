/**
 * @example "pol_50959709a8fb48feb6f990cd3de86963"
 */
type PolicyId = `pol_${string}`;

const isPolicyId = (candidate: string): candidate is PolicyId => {
    return /^pol_[0-9a-fA-F]{32}$/.test(candidate)
};

describe("Policy ID", () => {
    it("detects Policy ID", () => {
        const correctExample = `pol_5ed43cf4c2964a5fa55e65809a940b0b`;
        const actual = isPolicyId(correctExample);

        expect(actual).toBe(true);
    })
});
