export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number = 400,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
