export interface JwtPayload {
  sub: string;
  role: string;
}

export interface AuthUser {
  id: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}
