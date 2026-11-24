/** A request the Host refuses with one of the error codes of CONVENTION.md §5.1. */
export class ProtocolError extends Error {
  readonly code: string;
  /** The id of the granted folder the failure is about, when it is about one (`overlapping`). */
  readonly folder?: string;

  constructor(code: string, message: string, folder?: string) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    if (folder !== undefined) this.folder = folder;
  }
}
