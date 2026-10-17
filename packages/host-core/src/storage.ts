// The storage of each Module (CONVENTION.md §6.1): requests, limits and quotas.

import { LIMITS } from "@tessello/convention";
import type { Persistence } from "./persistence.ts";
import { ProtocolError } from "./protocol-error.ts";

type Handler = (moduleId: string, payload: unknown) => Promise<unknown>;

const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;
// What an entry costs against the total of its Module.
const entryBytes = (key: string, serialized: string) => byteLength(key) + byteLength(serialized);

const invalid = (message: string) => new ProtocolError("invalid_payload", message);

function payloadObject(payload: unknown): Record<string, unknown> {
  if (payload === undefined) return {};
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw invalid("payload must be an object");
  return payload as Record<string, unknown>;
}

function keyOf(payload: unknown): string {
  const { key } = payloadObject(payload);
  if (typeof key !== "string" || key.length === 0) throw invalid("key must be a non-empty string");
  return key;
}

function serialize(value: unknown): string {
  if (value === null || value === undefined) throw invalid("value must not be null: use storage.delete to remove a key");
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    // BigInt or a cycle: not a JSON value.
  }
  if (serialized === undefined) throw invalid("value must be a JSON value");
  return serialized;
}

export function createStorage(persistence: Persistence) {
  // The requests of one Module (from its View and its Widget) run one after the other,
  // so a quota check always sees the writes that came before it.
  const queues = new Map<string, Promise<unknown>>();
  const queued = (handler: Handler): Handler => (moduleId, payload) => {
    const run = (queues.get(moduleId) ?? Promise.resolve()).then(() => handler(moduleId, payload));
    queues.set(moduleId, run.catch(() => {}));
    return run;
  };

  const handlers: Record<string, Handler> = {
    "storage.get": async (moduleId, payload) => {
      const serialized = (await persistence.readStorage(moduleId)).get(keyOf(payload));
      return { value: serialized === undefined ? null : JSON.parse(serialized) };
    },
    "storage.set": async (moduleId, payload) => {
      const key = keyOf(payload);
      const serialized = serialize(payloadObject(payload).value);
      if (key.length > LIMITS.storageKeyLength) {
        throw new ProtocolError("quota_exceeded", `key must be at most ${LIMITS.storageKeyLength} characters`);
      }
      if (byteLength(serialized) > LIMITS.storageValueBytes) {
        throw new ProtocolError("quota_exceeded", `value must be at most ${LIMITS.storageValueBytes} bytes once serialized`);
      }
      const entries = await persistence.readStorage(moduleId);
      entries.set(key, serialized);
      const total = [...entries].reduce((sum, [entryKey, entryValue]) => sum + entryBytes(entryKey, entryValue), 0);
      if (total > LIMITS.storageTotalBytes) {
        throw new ProtocolError("quota_exceeded", `the storage of a Module must stay under ${LIMITS.storageTotalBytes} bytes`);
      }
      await persistence.writeStorage(moduleId, key, serialized);
      return {};
    },
    "storage.delete": async (moduleId, payload) => {
      await persistence.deleteStorageKey(moduleId, keyOf(payload));
      return {};
    },
    "storage.keys": async (moduleId, payload) => {
      payloadObject(payload);
      return { keys: [...(await persistence.readStorage(moduleId)).keys()] };
    },
  };
  return {
    handlers: Object.fromEntries(Object.entries(handlers).map(([type, handler]) => [type, queued(handler)])),
  };
}
