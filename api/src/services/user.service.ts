import bcrypt from 'bcryptjs';
import type { HydratedDocument, Types } from 'mongoose';
import { mongoose } from '../config/db';
import { UserModel } from '../models/user.model';
import { FolderModel } from '../models/folder.model';
import { ActivityLogModel } from '../models/activity-log.model';
import { normalizeEmail, normalizeName } from '../utils/normalize';
import type { CreateUserInput, PublicUser, User } from '../types/user';
import { BadRequestError, ConflictError, HttpError } from '../errors/http-error';

const ROOT_FOLDER_NAME = 'Mi unidad';

export class UserService {

  async createUser(
    { email, password, role = 'user', quotaBytes = null }: CreateUserInput,
    actorId: string | Types.ObjectId | null
  ): Promise<PublicUser> {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !password) {
      throw new BadRequestError('email y password son obligatorios');
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
          { session }
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
          { session }
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
          { session }
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
