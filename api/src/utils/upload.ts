import type { Request } from 'express';
import { Transform, TransformCallback } from 'stream';
import busboy from 'busboy';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { BadRequestError } from '../errors/http-error';
import { validateFile } from './file-validation';
import type { FileCategory } from '../types/file';

export interface StreamedUpload {
  filename: string;
  mimeType: string;
  category: FileCategory;
  size: number;
  gridFsId: Types.ObjectId;
  fields: Record<string, string>;
}

class Utf8Validator extends Transform {
  private decoder = new TextDecoder('utf-8', { fatal: true });

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      this.decoder.decode(chunk, { stream: true });
      callback(null, chunk);
    } catch {
      callback(new Error('INVALID_UTF8'));
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      this.decoder.decode();
      callback();
    } catch {
      callback(new Error('INVALID_UTF8'));
    }
  }
}

function bucket() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new BadRequestError('Sin conexión a MongoDB');
  }
  return new mongoose.mongo.GridFSBucket(db);
}

export async function deleteGridFsObject(gridFsId: Types.ObjectId): Promise<void> {
  try {
    await bucket().delete(gridFsId);
  } catch (err) {
    if (err instanceof mongoose.mongo.MongoRuntimeError && err.message.startsWith('File not found')) {
      return;
    }
    throw err;
  }
}

export function parseUpload(req: Request): Promise<StreamedUpload> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    let fileSeen = false;
    let settled = false;
    const fail = (err: Error): void => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    let parser: busboy.Busboy;
    try {
      parser = busboy({ headers: req.headers });
    } catch {
      fail(new BadRequestError('Petición multipart inválida'));
      return;
    }

    parser.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    parser.on('file', (name: string, stream, info: { filename: string; mimeType: string }) => {
      if (fileSeen) {
        stream.resume();
        fail(new BadRequestError('Un archivo por petición'));
        return;
      }
      let validated;
      try {
        validated = validateFile(info.filename, info.mimeType);
      } catch (err) {
        stream.resume();
        fail(err as Error);
        return;
      }
      fileSeen = true;
      const gridFsId = new Types.ObjectId();
      const upload = bucket().openUploadStream(info.filename, { id: gridFsId });
      const validator = new Utf8Validator();
      let size = 0;
      validator.on('data', (chunk: Buffer) => {
        size += chunk.length;
      });
      const cleanup = async (): Promise<void> => {
        stream.unpipe();
        validator.destroy();
        upload.destroy();
        await deleteGridFsObject(gridFsId);
      };
      validator.on('error', async (err: Error) => {
        await cleanup();
        fail(
          err.message === 'INVALID_UTF8'
            ? new BadRequestError('El contenido no es UTF-8 válido')
            : err
        );
      });
      upload.on('error', async (err: Error) => {
        await cleanup();
        fail(err);
      });
      upload.on('finish', () => {
        if (!settled) {
          settled = true;
          resolve({ filename: info.filename, mimeType: validated.mimeType, category: validated.category, size, gridFsId, fields });
        }
      });
      stream.on('error', async (err: Error) => {
        await cleanup();
        fail(err);
      });
      stream.pipe(validator).pipe(upload);
    });

    parser.on('error', (err: Error) => fail(err));
    parser.on('close', () => {
      if (!fileSeen) {
        fail(new BadRequestError('Falta el archivo'));
      }
    });
    req.pipe(parser);
  });
}
