// Checks shared by every request's payload (CONVENTION.md §5).

import { ProtocolError } from "./protocol-error.ts";

export const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;

export const invalid = (message: string) => new ProtocolError("invalid_payload", message);

/** The payload as an object; an absent payload counts as `{}`. */
export function payloadObject(payload: unknown): Record<string, unknown> {
  if (payload === undefined) return {};
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw invalid("payload must be an object");
  return payload as Record<string, unknown>;
}
