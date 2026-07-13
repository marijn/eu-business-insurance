/**
 * @example "agreement_"
 */
type AgreementId = `agreement_${string}`;

export const isAgreementId = (candidate: string): candidate is AgreementId => {
    return /^agreement_[0-9a-fA-F]{32}$/.test(candidate)
};
