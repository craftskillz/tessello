/** A request the Host refuses with one of the error codes of CONVENTION.md §5.1. */
export class ProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
  }
}
