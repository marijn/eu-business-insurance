import {v4 as uuidv4} from "uuid";

/**
 * @example "agreement_45975aee299143d28b8b4d07646bc827"
 */
export type AgreementId = `agreement_${string}`;

export const isAgreementId = (candidate: string): candidate is AgreementId => {
    return /^agreement_[0-9a-fA-F]{32}$/.test(candidate)
};

export const generateAgreementId = (): AgreementId => {
    return `agreement_${uuidv4().replace(/-/g, '')}`;
};
