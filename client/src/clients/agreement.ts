import { BaseAPIClient, APIResponse } from '../utils/client';
import {
  Agreement,
  AgreementRequest,
  AgreementVersion,
  SignatureStatus,
  SigningRequest,
  VoidAgreementRequest,
  SignatoryRole,
  Language,
} from '../interfaces/schemas';
import { BaseClientConfig } from '../utils/client';

export class AgreementEngineClient extends BaseAPIClient {
  constructor(config: BaseClientConfig = {}) {
    super(config);
  }

  public async generateAgreement(request: AgreementRequest): Promise<APIResponse<Agreement>> {
    return this.post<Agreement>('/agreements/generate', request);
  }

  public async getAgreement(
    agreementId: string,
    format: 'pdf' | 'html' | 'json' = 'json'
  ): Promise<APIResponse<Agreement>> {
    return this.get<Agreement>(`/agreements/${agreementId}`, { format });
  }

  public async listAgreementVersions(agreementId: string): Promise<APIResponse<{ versions: AgreementVersion[] }>> {
    return this.get<{ versions: AgreementVersion[] }>(`/agreements/${agreementId}/versions`);
  }

  public async initiateSigning(
    agreementId: string,
    request: {
      signatory_email: string;
      redirect_url?: string;
      signatory_role?: SignatoryRole;
    }
  ): Promise<APIResponse<SigningRequest>> {
    return this.post<SigningRequest>(`/agreements/${agreementId}/sign`, request);
  }

  public async getSignatures(agreementId: string): Promise<APIResponse<SignatureStatus>> {
    return this.get<SignatureStatus>(`/agreements/${agreementId}/signatures`);
  }

  public async voidAgreement(
    agreementId: string,
    request: VoidAgreementRequest
  ): Promise<APIResponse<Agreement>> {
    return this.post<Agreement>(`/agreements/${agreementId}/void`, request);
  }

  public async generateAndSignAgreement(
    agreementRequest: AgreementRequest,
    signatory: {
      email: string;
      role?: SignatoryRole;
      redirect_url?: string;
    }
  ): Promise<APIResponse<SigningRequest>> {
    const agreementResponse = await this.generateAgreement(agreementRequest);
    return this.initiateSigning(agreementResponse.data.id, {
      signatory_email: signatory.email,
      signatory_role: signatory.role,
      redirect_url: signatory.redirect_url,
    });
  }

  public async isAgreementFullySigned(agreementId: string): Promise<boolean> {
    const response = await this.getSignatures(agreementId);
    return response.data.all_signed;
  }

  public async getLatestAgreementVersion(agreementId: string): Promise<AgreementVersion | null> {
    const response = await this.listAgreementVersions(agreementId);
    if (response.data.versions.length === 0) {
      return null;
    }
    return response.data.versions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }

  public async generatePolicyAgreement(
    policyId: string,
    templateId: string,
    language: Language = 'en',
    variables?: Record<string, unknown>
  ): Promise<APIResponse<Agreement>> {
    return this.generateAgreement({
      policy_id: policyId,
      template_id: templateId,
      language,
      variables,
    });
  }

  public async generateEndorsementAgreement(
    policyId: string,
    endorsementId: string,
    templateId: string,
    language: Language = 'en',
    variables?: Record<string, unknown>
  ): Promise<APIResponse<Agreement>> {
    return this.generateAgreement({
      policy_id: policyId,
      endorsement_id: endorsementId,
      template_id: templateId,
      language,
      variables,
    });
  }

  public async getAgreementPDF(agreementId: string): Promise<APIResponse<Agreement>> {
    return this.getAgreement(agreementId, 'pdf');
  }

  public async getAgreementHTML(agreementId: string): Promise<APIResponse<Agreement>> {
    return this.getAgreement(agreementId, 'html');
  }
}

export function createAgreementEngineClient(config: BaseClientConfig = {}): AgreementEngineClient {
  return new AgreementEngineClient(config);
}
