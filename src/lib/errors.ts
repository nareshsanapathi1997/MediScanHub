export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof DomainError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
