import {QuoteId} from "./idGenerator";

const isQuoteId = (candidate: string): candidate is QuoteId => {
    return /^quote_(?:[0-9a-fA-F]{32})$/.test(candidate)
};

describe("Quote ID", () => {
    it("detects Quote ID", () => {
        const correctExample = `quote_1c30bc240e5945fb93efd8fa02f3956f`
        const actual = isQuoteId(correctExample);

        expect(actual).toBe(true);
    })
});
