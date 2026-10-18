import bcrypt from 'bcryptjs';
import type { HydratedDocument, Types } from 'mongoose';
import { mongoose } from '../config/db';
import { UserModel } from '../models/user.model';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ActivityLogModel } from '../models/activity-log.model';
import { normalizeEmail, normalizeName, isValidEmail } from '../utils/normalize';
import type { CreateUserInput, ListUsersQuery, PagedUsers, PublicUser, User } from '../types/user';
import { BadRequestError, ConflictError, HttpError, NotFoundError } from '../errors/http-error';

const ROOT_FOLDER_NAME = 'Mi unidad';

function toPage(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : Math.min(parsed, 100);
}

export interface UpdateSelfInput {
  email?: unknown;
  password?: unknown;
}

export interface StorageInfo {
  usedBytes: number;
  quotaBytes: number | null;
  available: number | null;
  reconciled?: { sumBytes: number; matches: boolean };
}

export interface UpdateUserInput {
  email?: unknown;
  password?: unknown;
  role?: unknown;
}

export class UserService {
  async listUsers(query: ListUsersQuery): Promise<PagedUsers> {
    const page = toPage(query.page, 1);
    const limit = toPage(query.limit, 20);
    const filter: Record<string, unknown> = {};
    if (typeof query.q === 'string' && query.q.trim()) {
      filter.emailNormalized = { $regex: query.q.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
    }
    if (query.role === 'admin' || query.role === 'user') {
      filter.role = query.role;
    }
    const [data, total] = await Promise.all([
      UserModel.find(filter).sort({ emailNormalized: 1 }).skip((page - 1) * limit).limit(limit),
      UserModel.countDocuments(filter),
    ]);
    return { data: data.map((user) => this.toPublicUser(user)), total, page, limit };
  }


  async createUser(
    { email, password, role = 'user', quotaBytes = null }: CreateUserInput,
    actorId: string | Types.ObjectId | null
  ): Promise<PublicUser> {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !password) {
    throw new BadRequestError('email y password son obligatorios');
  }
  if (!isValidEmail(cleanEmail)) {
    throw new BadRequestError('email inválido');
  }
    if (role !== 'admin' && role !== 'user') {
      throw new BadRequestError('role debe ser admin o user');
    }
    const session = await mongoose.startSession();
    try {
      let created: HydratedDocument<User> | undefined;
      await session.withTransaction(async () => {
        const passwordHash = await bcrypt.hash(password, 10);
        [created] = await UserModel.create(
          [
            {
              email: email.trim(),
              emailNormalized: cleanEmail,
              passwordHash,
              role,
              storage: { quotaBytes, usedBytes: 0 },
            },
          ],
          { session, ordered: true }
        );
        if (!created) {
          throw new HttpError(500, 'No se pudo crear el usuario');
        }
        await FolderModel.create(
          [
            {
              ownerId: created._id,
              createdBy: created._id,
              parentId: null,
              isRoot: true,
              name: ROOT_FOLDER_NAME,
              nameNormalized: normalizeName(ROOT_FOLDER_NAME),
            },
          ],
          { session, ordered: true }
        );
        await ActivityLogModel.create(
          [
            {
              userId: actorId || created._id,
              action: 'USER_CREATE',
              status: 'success',
              resourceType: 'user',
              resourceId: created._id,
              resourceSnapshot: { email: created.email },
              affectedUserIds: [],
            },
          ],
          { session, ordered: true }
        );
      });
      if (!created) {
        throw new HttpError(500, 'No se pudo crear el usuario');
      }
      return this.toPublicUser(created);
    } catch (err) {
      if (err instanceof HttpError) {
        throw err;
      }
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('El email ya está registrado');
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async updateSelf(id: string, patch: UpdateSelfInput): Promise<PublicUser> {
    const updates: Record<string, unknown> = {};
    if (patch.email !== undefined) {
      const clean = normalizeEmail(patch.email);
      if (!isValidEmail(clean)) {
        throw new BadRequestError('email inválido');
      }
      updates.email = String(patch.email).trim();
      updates.emailNormalized = clean;
    }
    if (patch.password !== undefined) {
      if (!String(patch.password)) {
        throw new BadRequestError('password inválido');
      }
      updates.passwordHash = await bcrypt.hash(String(patch.password), 10);
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestError('Nada que actualizar');
    }
    try {
      const updated = await UserModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
      if (!updated) {
        throw new NotFoundError('Usuario no encontrado');
      }
      return this.toPublicUser(updated);
    } catch (err) {
      if (err instanceof HttpError) {
        throw err;
      }
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('El email ya está registrado');
      }
      throw err;
    }
  }

  async setActiveStatus(
    id: string,
    isActive: unknown,
    actorId: string | Types.ObjectId | null
  ): Promise<PublicUser> {
    if (typeof isActive !== 'boolean') {
      throw new BadRequestError('isActive debe ser booleano');
    }
    if (actorId && id === String(actorId)) {
      throw new BadRequestError('No puedes cambiar tu propio estado');
    }
    const target = await UserModel.findById(id);
    if (!target) {
      throw new NotFoundError('Usuario no encontrado');
    }
    if (target.isActive === isActive) {
      return this.toPublicUser(target);
    }
    target.isActive = isActive;
    await target.save();
    await ActivityLogModel.create({
      userId: actorId || target._id,
      action: 'USER_STATUS_CHANGE',
      status: 'success',
      resourceType: 'user',
      resourceId: target._id,
      resourceSnapshot: { email: target.email },
      details: { previousIsActive: !isActive, newIsActive: isActive },
      affectedUserIds: [target._id],
    });
    return this.toPublicUser(target);
  }

  async updateQuota(
    id: string,
    quotaBytes: unknown,
    actorId: string | Types.ObjectId | null
  ): Promise<PublicUser> {
    if (quotaBytes !== null && (typeof quotaBytes !== 'number' || !Number.isFinite(quotaBytes) || quotaBytes < 0)) {
      throw new BadRequestError('quotaBytes debe ser un número mayor o igual a 0, o null');
    }
    const target = await UserModel.findById(id);
    if (!target) {
      throw new NotFoundError('Usuario no encontrado');
    }
    const previous = target.storage.quotaBytes ?? null;
    target.storage.quotaBytes = quotaBytes;
    await target.save();
    await ActivityLogModel.create({
      userId: actorId || target._id,
      action: 'QUOTA_CHANGE',
      status: 'success',
      resourceType: 'user',
      resourceId: target._id,
      resourceSnapshot: { email: target.email },
      details: { previousQuotaBytes: previous, newQuotaBytes: quotaBytes },
      affectedUserIds: [target._id],
    });
    return this.toPublicUser(target);
  }

  async getStorage(id: string, reconcile: boolean): Promise<StorageInfo> {
    const user = await UserModel.findById(id);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }
    const usedBytes = user.storage.usedBytes;
    const quotaBytes = user.storage.quotaBytes ?? null;
    const info: StorageInfo = {
      usedBytes,
      quotaBytes,
      available: quotaBytes === null ? null : quotaBytes - usedBytes,
    };
    if (reconcile) {
      const agg = await FileModel.aggregate([
        { $match: { ownerId: user._id } },
        { $group: { _id: null, sumBytes: { $sum: '$size' } } },
      ]);
      const sumBytes = (agg[0]?.sumBytes as number | undefined) ?? 0;
      info.reconciled = { sumBytes, matches: sumBytes === usedBytes };
    }
    return info;
  }

  async updateUser(
    id: string,
    patch: UpdateUserInput,
    actorId: string | Types.ObjectId | null
  ): Promise<PublicUser> {
    const updates: Record<string, unknown> = {};
    if (patch.email !== undefined) {
      const clean = normalizeEmail(patch.email);
      if (!isValidEmail(clean)) {
        throw new BadRequestError('email inválido');
      }
      updates.email = String(patch.email).trim();
      updates.emailNormalized = clean;
    }
    if (patch.password !== undefined) {
      if (!String(patch.password)) {
        throw new BadRequestError('password inválido');
      }
      updates.passwordHash = await bcrypt.hash(String(patch.password), 10);
    }
    if (patch.role !== undefined) {
      if (patch.role !== 'admin' && patch.role !== 'user') {
        throw new BadRequestError('role debe ser admin o user');
      }
      if (actorId && id === String(actorId)) {
        throw new BadRequestError('No puedes cambiar tu propio rol');
      }
      updates.role = patch.role;
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestError('Nada que actualizar');
    }
    try {
      const updated = await UserModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
      if (!updated) {
        throw new NotFoundError('Usuario no encontrado');
      }
      return this.toPublicUser(updated);
    } catch (err) {
      if (err instanceof HttpError) {
        throw err;
      }
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('El email ya está registrado');
      }
      throw err;
    }
  }

  async findByEmail(email: unknown): Promise<{ id: string; email: string }> {
    const clean = normalizeEmail(email);
    if (!isValidEmail(clean)) {
      throw new BadRequestError('email inválido');
    }
    const user = await UserModel.findOne({ emailNormalized: clean });
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }
    return { id: user._id.toString(), email: user.email };
  }

  private toPublicUser(user: HydratedDocument<User>): PublicUser {
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      storage: user.storage,
      createdAt: user.createdAt,
    };
  }
}
