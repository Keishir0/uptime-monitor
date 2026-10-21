export type FieldIssue = { path: string; message: string };

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly issues: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string) => new AppError(400, "BAD_REQUEST", message);
/** Regra de negócio ligada a um campo: mesmo formato das issues do zod, para o front exibir no campo. */
export const fieldError = (path: string, message: string) =>
  new AppError(400, "VALIDATION_ERROR", message, [{ path, message }]);
export const unauthorized = (message = "Não autenticado") => new AppError(401, "UNAUTHORIZED", message);
export const notFound = (message = "Recurso não encontrado") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);
