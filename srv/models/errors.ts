export class DomainError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly target?: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
