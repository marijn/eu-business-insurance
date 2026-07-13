import {AgreementId, isAgreementId} from "./AgreementId";
import {v4 as uuidv4} from "uuid";

const generateAgreementId = (): AgreementId => {
    return `agreement_${uuidv4().replace(/-/g, '')}`;
};

describe("Agreement ID", () => {
    it("detects Agreement ID", () => {
        const correctExample = `agreement_44324591e3db454fbf09ef125ff1f102`;
        const actual = isAgreementId(correctExample);

        expect(actual).toBe(true);
    })

    it("detects incorrect Agreement ID", () => {
        const incorrectExample = `agg_45975aee299143d28b8b4d07646bc827`;
        const actual = isAgreementId(incorrectExample);

        expect(actual).toBe(false);
    })

    it("Generates Agreement ID", () => {
        const agreementId = generateAgreementId();
        const actual = isAgreementId(agreementId);
        expect(actual).toBe(true);
    })
});
