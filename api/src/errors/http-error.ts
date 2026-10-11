export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'No autorizado') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Prohibido') {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'No encontrado') {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
  }
}
