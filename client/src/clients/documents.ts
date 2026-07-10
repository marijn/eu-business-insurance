import { BaseAPIClient, APIResponse } from '../utils/client';
import {
  Document,
  DocumentList,
  UploadDocumentRequest,
  RedactDocumentRequest,
  EntityType,
  DocumentType,
  RetentionPolicy,
} from '../interfaces/schemas';
import { BaseClientConfig } from '../utils/client';

export class DocumentManagementClient extends BaseAPIClient {
  constructor(config: BaseClientConfig = {}) {
    super(config);
  }

  public async uploadDocument(
    file: Blob | Buffer,
    request: UploadDocumentRequest
  ): Promise<APIResponse<Document>> {
    const formData = new FormData();
    formData.append('file', file instanceof Blob ? file : new Blob([new Uint8Array(file)]), request.entity_id);
    formData.append('entity_type', request.entity_type);
    formData.append('entity_id', request.entity_id);
    formData.append('type', request.type);
    if (request.retention_policy) {
      formData.append('retention_policy', request.retention_policy);
    }

    return this.post<Document>('/documents/upload', formData, {}, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  public async listDocuments(entityType: EntityType, entityId: string): Promise<APIResponse<DocumentList>> {
    return this.get<DocumentList>('/documents', { entity_type: entityType, entity_id: entityId });
  }

  public async getDocument(documentId: string): Promise<APIResponse<Document>> {
    return this.get<Document>(`/documents/${documentId}`);
  }

  public async deleteDocument(documentId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/documents/${documentId}`);
  }

  public async downloadDocument(documentId: string): Promise<APIResponse<Blob>> {
    return this.get<Blob>(`/documents/${documentId}/download`, {}, {
      responseType: 'blob',
    });
  }

  public async redactDocument(
    documentId: string,
    request: RedactDocumentRequest
  ): Promise<APIResponse<Document>> {
    return this.post<Document>(`/documents/${documentId}/redact`, request);
  }

  public async uploadPolicyDocument(
    file: Blob | Buffer,
    policyId: string,
    documentType: DocumentType = 'POLICY_DOCUMENT',
    retentionPolicy: RetentionPolicy = '7_YEARS'
  ): Promise<APIResponse<Document>> {
    return this.uploadDocument(file, {
      entity_type: 'POLICY' as EntityType,
      entity_id: policyId,
      type: documentType,
      retention_policy: retentionPolicy,
    });
  }

  public async uploadClaimDocument(
    file: Blob | Buffer,
    claimId: string,
    documentType: DocumentType = 'CLAIM_FORM',
    retentionPolicy: RetentionPolicy = '7_YEARS'
  ): Promise<APIResponse<Document>> {
    return this.uploadDocument(file, {
      entity_type: 'CLAIM' as EntityType,
      entity_id: claimId,
      type: documentType,
      retention_policy: retentionPolicy,
    });
  }

  public async uploadInvoiceDocument(
    file: Blob | Buffer,
    invoiceId: string,
    documentType: DocumentType = 'INVOICE',
    retentionPolicy: RetentionPolicy = '7_YEARS'
  ): Promise<APIResponse<Document>> {
    return this.uploadDocument(file, {
      entity_type: 'INVOICE' as EntityType,
      entity_id: invoiceId,
      type: documentType,
      retention_policy: retentionPolicy,
    });
  }

  public async uploadAgreementDocument(
    file: Blob | Buffer,
    agreementId: string,
    documentType: DocumentType = 'OTHER',
    retentionPolicy: RetentionPolicy = '7_YEARS'
  ): Promise<APIResponse<Document>> {
    return this.uploadDocument(file, {
      entity_type: 'AGREEMENT' as EntityType,
      entity_id: agreementId,
      type: documentType,
      retention_policy: retentionPolicy,
    });
  }

  public async uploadBusinessDocument(
    file: Blob | Buffer,
    businessId: string,
    documentType: DocumentType = 'OTHER',
    retentionPolicy: RetentionPolicy = '7_YEARS'
  ): Promise<APIResponse<Document>> {
    return this.uploadDocument(file, {
      entity_type: 'BUSINESS' as EntityType,
      entity_id: businessId,
      type: documentType,
      retention_policy: retentionPolicy,
    });
  }

  public async getDocumentsForEntity(
    entityType: EntityType,
    entityId: string
  ): Promise<Document[]> {
    const response = await this.listDocuments(entityType, entityId);
    return response.data.documents;
  }

  public async getPolicyDocuments(policyId: string): Promise<Document[]> {
    return this.getDocumentsForEntity('POLICY' as EntityType, policyId);
  }

  public async getClaimDocuments(claimId: string): Promise<Document[]> {
    return this.getDocumentsForEntity('CLAIM' as EntityType, claimId);
  }

  public async deleteAllDocumentsForEntity(
    entityType: EntityType,
    entityId: string
  ): Promise<void> {
    const documents = await this.getDocumentsForEntity(entityType, entityId);
    
    for (const document of documents) {
      await this.deleteDocument(document.id);
    }
  }

  public async redactAllDocumentsForEntity(
    entityType: EntityType,
    entityId: string,
    fields: string[]
  ): Promise<Document[]> {
    const documents = await this.getDocumentsForEntity(entityType, entityId);
    const redactedDocuments: Document[] = [];
    
    for (const document of documents) {
      const response = await this.redactDocument(document.id, { fields });
      redactedDocuments.push(response.data);
    }
    
    return redactedDocuments;
  }

  public async downloadDocumentAsFile(
    documentId: string,
    fileName?: string
  ): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
    const response = await this.downloadDocument(documentId);
    const document = await this.getDocument(documentId);
    
    return {
      blob: response.data,
      fileName: fileName || document.data.file_name,
      mimeType: document.data.mime_type,
    };
  }

  public async getDocumentURL(documentId: string): Promise<string> {
    const response = await this.getDocument(documentId);
    return response.data.url;
  }

  public async documentExists(documentId: string): Promise<boolean> {
    try {
      await this.getDocument(documentId);
      return true;
    } catch {
      return false;
    }
  }

  public async getMultipleDocuments(documentIds: string[]): Promise<Document[]> {
    const documents: Document[] = [];
    
    for (const documentId of documentIds) {
      try {
        const response = await this.getDocument(documentId);
        documents.push(response.data);
      } catch {
        continue;
      }
    }
    
    return documents;
  }
}

export function createDocumentManagementClient(config: BaseClientConfig = {}): DocumentManagementClient {
  return new DocumentManagementClient(config);
}
