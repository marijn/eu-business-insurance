import { Router } from 'express';
import { createHash } from 'crypto';
import { generateId } from '../utils/idGenerator';
import { storage } from '../storage';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import { upload } from '../middleware/upload';
import { validateSchema, documentUploadSchema, documentListQuerySchema, redactRequestSchema } from '../utils/validation';
import { Document, MimeType } from '../types';
import { clock } from '../utils/clock';
import { audit } from '../services/audit';

const router = Router();

const MIME_TYPES: MimeType[] = ['application/pdf', 'application/json', 'text/plain', 'image/jpeg', 'image/png'];

async function getDocumentOr404(documentId: string): Promise<Document> {
  const document = await storage.getDocument(documentId);
  if (!document) throw notFound('Document');
  return document;
}

router.get('/', asyncHandler(async (req, res) => {
  const { entity_type, entity_id } = validateSchema(documentListQuerySchema, req.query);
  const documents = (await storage.listDocuments()).filter(d => d.entity_type === entity_type && d.entity_id === entity_id);
  res.json({ documents });
}));

router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const { entity_type, entity_id, type, retention_policy } = validateSchema(documentUploadSchema, req.body ?? {});
  const file = req.file;
  if (!file) throw badRequest('file is required', 'file');
  if (!MIME_TYPES.includes(file.mimetype as MimeType) && file.mimetype !== 'application/octet-stream') {
    throw badRequest(`Unsupported file type ${file.mimetype}`, 'file');
  }

  const lookup: Record<string, (id: string) => Promise<unknown>> = {
    POLICY: storage.getPolicy,
    CLAIM: storage.getClaim,
    INVOICE: storage.getInvoice,
    AGREEMENT: storage.getAgreement,
  };
  if (lookup[entity_type] && !(await lookup[entity_type](entity_id))) {
    throw badRequest(`${entity_type} ${entity_id} does not exist`, 'entity_id');
  }

  const documentId = generateId('document');
  const document: Document = {
    id: documentId,
    entity_type,
    entity_id,
    type,
    file_name: file.originalname,
    mime_type: (file.mimetype === 'application/octet-stream' ? 'application/pdf' : file.mimetype) as MimeType,
    size: file.size,
    url: `https://documents.insureeu.com/${entity_type.toLowerCase()}/${entity_id}/${documentId}`,
    checksum: 'sha256:' + createHash('sha256').update(file.buffer).digest('hex'),
    storage_location: 'EU_CENTRAL',
    retention_policy,
    created_at: clock.now().toISOString(),
  };

  await storage.createDocument(document, file.buffer);

  if (entity_type === 'CLAIM') {
    const claim = await storage.getClaim(entity_id);
    if (claim) await storage.updateClaim(entity_id, { documents: [...(claim.documents || []), document] });
  }

  await audit(req, 'DOCUMENT_UPLOADED', 'DOCUMENT', documentId, {
    entity_type,
    entity_id,
    document_type: type,
  });

  res.status(201).json(document);
}));

router.get('/:document_id', asyncHandler(async (req, res) => {
  res.json(await getDocumentOr404(req.params.document_id));
}));

router.delete('/:document_id', asyncHandler(async (req, res) => {
  const { document_id } = req.params;
  const document = await getDocumentOr404(document_id);
  await storage.deleteDocument(document_id);

  if (document.entity_type === 'CLAIM') {
    const claim = await storage.getClaim(document.entity_id);
    if (claim) {
      await storage.updateClaim(claim.id, { documents: (claim.documents || []).filter(d => d.id !== document_id) });
    }
  }

  await audit(req, 'DOCUMENT_DELETED', 'DOCUMENT', document_id, {
    entity_type: document.entity_type,
    entity_id: document.entity_id,
  });

  res.json({ message: 'Document deleted' });
}));

router.get('/:document_id/download', asyncHandler(async (req, res) => {
  const document = await getDocumentOr404(req.params.document_id);
  const content = await storage.getDocumentContent(document.id);

  if (!content) {
    res.json(document);
    return;
  }
  res.setHeader('Content-Type', document.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.file_name)}"`);
  res.send(content);
}));

router.post('/:document_id/redact', asyncHandler(async (req, res) => {
  const { document_id } = req.params;
  const { fields } = validateSchema(redactRequestSchema, req.body);
  const document = await getDocumentOr404(document_id);

  await audit(req, 'DOCUMENT_REDACTED', 'DOCUMENT', document_id, { fields_redacted: fields });

  res.json(document);
}));

export { router as documentsRouter };
