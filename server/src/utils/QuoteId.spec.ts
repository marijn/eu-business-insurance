import {QuoteId} from "./idGenerator";

const isQuoteId = (candidate: string): candidate is QuoteId => {
    throw new Error("TODO: Implement me!");
};

describe("Quote ID", () => {
    it("detects Quote ID", () => {
        const correctExample = `quote_1c30bc240e5945fb93efd8fa02f3956f`
        const actual = isQuoteId(correctExample);

        expect(actual).toBe(true);
    })
});
