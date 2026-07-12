/**
 * @example "pol_50959709a8fb48feb6f990cd3de86963"
 */
export type PolicyId = `pol_${string}`;

export const isPolicyId = (candidate: string): candidate is PolicyId => {
    return /^pol_[0-9a-fA-F]{32}$/.test(candidate)
};
