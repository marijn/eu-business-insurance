import {QuoteId} from "./idGenerator";

export const isQuoteId = (candidate: string): candidate is QuoteId => {
    return /^quote_(?:[0-9a-fA-F]{32})$/.test(candidate)
};
