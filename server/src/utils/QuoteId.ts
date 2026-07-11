export type QuoteId = `quote_${string}`

export const isQuoteId = (candidate: string): candidate is QuoteId => {
    return /^quote_(?:[0-9a-fA-F]{32})$/.test(candidate)
};
