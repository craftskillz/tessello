// Folders the User grants a Module and the files in them (ADR 0022): requests `folders.*` and `files.*`.

import type { Drive, DriveFile, DriveFolder } from "./drive.ts";
import { invalid, payloadObject } from "./payload.ts";
import type { Persistence } from "./persistence.ts";
import { ProtocolError } from "./protocol-error.ts";

type Handler = (moduleId: string, payload: unknown) => Promise<unknown>;

export function createFolders(persistence: Persistence, drive: Drive) {
  const allowed = async (moduleId: string) => {
    const registered = (await persistence.registry.read()).find((module) => module.id === moduleId);
    if (registered?.permissions.folders !== true) {
      throw new ProtocolError("not_allowed", 'Declare "folders": true in the Manifest\'s permissions to ask for folders.');
    }
  };

  /** The granted folder a request names. */
  const folderOf = async (moduleId: string, payload: Record<string, unknown>): Promise<DriveFolder> => {
    await allowed(moduleId);
    if (typeof payload.folder !== "string") throw invalid("folder must be the id of a granted folder");
    const folder = (await drive.grants.read(moduleId)).get(payload.folder);
    if (!folder) throw new ProtocolError("not_found", "This folder is not granted to the Module.");
    return folder;
  };

  /** The granted folder a request names, once the browser lets the Host use it. */
  const usable = async (moduleId: string, payload: Record<string, unknown>): Promise<DriveFolder> => {
    const folder = await folderOf(moduleId, payload);
    if ((await folder.state()) !== "granted") {
      throw new ProtocolError("unavailable", `The User must allow "${folder.name}" again: call folders.reconnect from a click.`);
    }
    return folder;
  };

  // The requests on one folder run one after the other, so a version check always sees the writes that came before it.
  // A Drive may give a new DriveFolder at each read of the grants: the queue is the grant's, by Module and id.
  const queues = new Map<string, Promise<unknown>>();
  const queued = <T>(moduleId: string, request: Record<string, unknown>, run: () => Promise<T>): Promise<T> => {
    const key = `${moduleId}\u0000${request.folder as string}`;
    const result = (queues.get(key) ?? Promise.resolve()).then(run);
    queues.set(key, result.catch(() => {}));
    return result;
  };

  const granted = async (moduleId: string) => {
    const folders = [];
    for (const [id, folder] of await drive.grants.read(moduleId)) folders.push({ id, name: folder.name, state: await folder.state() });
    return folders;
  };

  const handlers: Record<string, Handler> = {
    "files.write": async (moduleId, payload) => {
      const request = payloadObject(payload);
      const folder = await usable(moduleId, request);
      const path = pathOf(request.path);
      const content = contentOf(request.content);
      const ifVersion = request.ifVersion;
      if (ifVersion !== undefined && ifVersion !== null && typeof ifVersion !== "string") throw invalid("ifVersion must be a version, or null");
      return queued(moduleId, request, async () => {
        if (ifVersion !== undefined) {
          const current = await folder.read(path);
          const now = current ? versionOf(current) : null;
          if (now !== ifVersion) {
            throw new ProtocolError("conflict", `"${path.join("/")}" ${now === null ? "no longer exists" : ifVersion === null ? "already exists" : "changed since this version"}.`);
          }
        }
        const lastModified = await folder.write(path, content);
        return { version: versionOf({ lastModified, size: content.byteLength }) };
      });
    },
    "files.read": async (moduleId, payload) => {
      const request = payloadObject(payload);
      const folder = await usable(moduleId, request);
      const path = pathOf(request.path);
      const file = await folder.read(path);
      if (!file) throw new ProtocolError("not_found", `There is no file "${path.join("/")}".`);
      if (request.as !== undefined && request.as !== "text" && request.as !== "bytes") throw invalid('as must be "text" or "bytes"');
      return { content: request.as === "bytes" ? file.bytes : new TextDecoder().decode(file.bytes), version: versionOf(file) };
    },
    "files.list": async (moduleId, payload) => {
      const request = payloadObject(payload);
      const folder = await usable(moduleId, request);
      const path = request.path === undefined ? [] : pathOf(request.path);
      if ((await folder.kind(path)) !== "folder") throw new ProtocolError("not_found", `There is no folder "${path.join("/")}".`);
      const entries = (await folder.list(path)).map((entry) =>
        entry.kind === "file"
          ? { kind: "file", path: entry.path.join("/"), version: versionOf({ lastModified: entry.lastModified, size: entry.size }), modified: entry.lastModified }
          : { kind: "folder", path: entry.path.join("/") },
      );
      return { entries };
    },
    "files.delete": async (moduleId, payload) => {
      const request = payloadObject(payload);
      const folder = await usable(moduleId, request);
      const path = pathOf(request.path);
      return queued(moduleId, request, async () => {
        if ((await folder.kind(path)) === null) throw new ProtocolError("not_found", `There is nothing at "${path.join("/")}".`);
        await folder.remove(path);
        return {};
      });
    },
    "files.move": async (moduleId, payload) => {
      const request = payloadObject(payload);
      const folder = await usable(moduleId, request);
      const from = pathOf(request.from);
      const to = pathOf(request.to);
      if (to.length > from.length && from.every((part, index) => to[index] === part)) {
        throw invalid(`"${from.join("/")}" cannot move into itself`);
      }
      return queued(moduleId, request, async () => {
        const kind = await folder.kind(from);
        if (kind === null) throw new ProtocolError("not_found", `There is nothing at "${from.join("/")}".`);
        if ((await folder.kind(to)) !== null) throw new ProtocolError("conflict", `"${to.join("/")}" already exists.`);
        if (kind === "file") {
          await folder.moveFile(from, to);
          return {};
        }
        // A folder cannot be moved by the browser (ADR 0022): each file moves, then the emptied folder is removed.
        for (const entry of await folder.list(from)) {
          if (entry.kind === "file") await folder.moveFile(entry.path, [...to, ...entry.path.slice(from.length)]);
        }
        await folder.remove(from);
        return {};
      });
    },
    "folders.request": async (moduleId, payload) => {
      const request = payloadObject(payload);
      await allowed(moduleId);
      const inner = request.mustContain === undefined ? null : await folderOf(moduleId, { folder: request.mustContain });
      const chosen = await drive.pick();
      if (!chosen) return { folder: null };
      if (inner && !(await chosen.contains(inner))) {
        throw new ProtocolError("not_containing", `"${chosen.name}" does not contain the folder "${inner.name}".`);
      }
      const grants = await drive.grants.read(moduleId);
      for (const [id, folder] of grants) {
        if (await folder.isSame(chosen)) return { folder: { id, name: folder.name } };
      }
      const id = crypto.randomUUID();
      await drive.grants.write(moduleId, id, chosen);
      return { folder: { id, name: chosen.name } };
    },
    "folders.list": async (moduleId, payload) => {
      payloadObject(payload);
      await allowed(moduleId);
      return { folders: await granted(moduleId) };
    },
    "folders.reconnect": async (moduleId, payload) => {
      const folder = await folderOf(moduleId, payloadObject(payload));
      return { state: await folder.reconnect() };
    },
    "folders.release": async (moduleId, payload) => {
      const request = payloadObject(payload);
      await folderOf(moduleId, request);
      await drive.grants.delete(moduleId, request.folder as string);
      return {};
    },
  };
  return {
    handlers,
    /** The folders granted to a Module, for its About screen. */
    granted,
    /** Takes a folder back from a Module, as the User asks; its files stay on disk. */
    revoke: (moduleId: string, id: string) => drive.grants.delete(moduleId, id),
    /** Forgets every folder granted to a Module, as when it is uninstalled. */
    async forget(moduleId: string) {
      for (const id of (await drive.grants.read(moduleId)).keys()) await drive.grants.delete(moduleId, id);
    },
  };
}

/** A file's version: it changes with each write, by the Module or by anyone else. */
const versionOf = (file: { lastModified: number; size: number } | DriveFile) =>
  `${file.lastModified}:${"bytes" in file ? file.bytes.byteLength : file.size}`;

/** What a Module writes: text, or bytes. */
function contentOf(content: unknown): Uint8Array {
  if (typeof content === "string") return new TextEncoder().encode(content);
  if (content instanceof Uint8Array) return content;
  throw invalid("content must be a string or a Uint8Array");
}

/** A path relative to the folder, as its parts: never outside it, and in one spelling only. */
function pathOf(path: unknown): string[] {
  if (typeof path !== "string" || path.length === 0) throw invalid("path must be a non-empty string");
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === ".." || part.includes("\\"))) {
    throw invalid(`path "${path}" must be relative to the folder, with "/" between names, and no "", "." or ".." part`);
  }
  return parts;
}
