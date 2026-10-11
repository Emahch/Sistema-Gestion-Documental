import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserModel } from '../models/user.model';
import { normalizeEmail } from '../utils/normalize';
import type { LoginResult } from '../types/auth';
import { UnauthorizedError } from '../errors/http-error';

export class AuthService {

  async login(email: unknown, password: unknown): Promise<LoginResult> {
    const user = await UserModel.findOne({ emailNormalized: normalizeEmail(email) });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Credenciales inválidas');
    }
    const matches = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!matches) {
      throw new UnauthorizedError('Credenciales inválidas');
    }
    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  }
}
