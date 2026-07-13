/**
 * @example "agreement_45975aee299143d28b8b4d07646bc827"
 */
export type AgreementId = `agreement_${string}`;

export const isAgreementId = (candidate: string): candidate is AgreementId => {
    return /^agreement_[0-9a-fA-F]{32}$/.test(candidate)
};
