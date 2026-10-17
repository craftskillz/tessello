// Opening a Module's View from its Widget (CONVENTION.md §6.3).

import { LIMITS } from "@tessello/convention";
import { byteLength, invalid, payloadObject } from "./payload.ts";

/** The params of a `navigation.openView` payload: a flat object of strings, `{}` when absent. */
export function paramsOf(payload: unknown): Record<string, string> {
  const { params } = payloadObject(payload);
  if (params === undefined) return {};
  if (typeof params !== "object" || params === null || Array.isArray(params)) throw invalid("params must be an object");
  if (!Object.values(params).every((value) => typeof value === "string")) throw invalid("every param must be a string");
  if (byteLength(JSON.stringify(params)) > LIMITS.openViewParamsBytes) {
    throw invalid(`params must be at most ${LIMITS.openViewParamsBytes} bytes once serialized`);
  }
  return params as Record<string, string>;
}
