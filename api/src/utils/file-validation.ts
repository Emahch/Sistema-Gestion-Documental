import path from 'path';
import { BadRequestError } from '../errors/http-error';
import type { FileCategory } from '../types/file';

const ALLOWED_MIME = new Set(['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream']);

export interface ValidatedFile {
  ext: string;
  mimeType: string;
  category: FileCategory;
}

export function validateFile(name: unknown, mimeType: unknown): ValidatedFile {
  const filename = String(name ?? '');
  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.txt' && ext !== '.md') {
    throw new BadRequestError('Extensión no permitida (solo .txt y .md)');
  }
  const mime = String(mimeType ?? '');
  if (!ALLOWED_MIME.has(mime)) {
    throw new BadRequestError('MIME no permitido');
  }
  return { ext, mimeType: mime, category: ext === '.md' ? 'MD' : 'TXT' };
}
