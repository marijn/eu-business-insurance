import {isPolicyId} from "./PolicyId";

describe("Policy ID", () => {
    it("detects Policy ID", () => {
        const correctExample = `pol_5ed43cf4c2964a5fa55e65809a940b0b`;
        const actual = isPolicyId(correctExample);

        expect(actual).toBe(true);
    })

    it("detects incorrect Policy ID", () => {
        const incorrectExample = `policy_5ed43cf4c2964a5fa55e65809a940b0b`;
        const actual = isPolicyId(incorrectExample);

        expect(actual).toBe(false);
    })
});
