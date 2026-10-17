// In-memory stand-in for the postMessage link between the Host and a sandboxed iframe (test entry point C).
// Delivery is asynchronous and structured-cloned, as with window.postMessage.

import type { Transport } from "@tessello/sdk";
import type { Host, SurfaceOptions } from "../src/index.ts";

export interface MemoryFrame {
  /** What the SDK uses inside the iframe. */
  transport: Transport;
  /** Every message the Host posted to this iframe, in order. */
  received: unknown[];
  /** Sends a raw message to the Host from this iframe, as a Module speaking the protocol by hand would. */
  post(message: unknown): void;
  /** Sends a raw request and resolves with the Host's response to it. */
  request(type: string, payload?: unknown): Promise<Response>;
}

export interface Response {
  tessello: 1;
  type: "response";
  id: string;
  ok: boolean;
  result?: any;
  error?: { code: string; message: string };
}

/** Creates an iframe for a surface and mounts it in the Host. */
export function mountFrame(host: Host, options: Omit<SurfaceOptions, "frame">): MemoryFrame {
  const listeners = new Set<(data: unknown) => void>();
  const received: unknown[] = [];
  const frame = {
    postMessage(message: unknown) {
      const data = structuredClone(message);
      setTimeout(() => {
        received.push(data);
        for (const listener of listeners) listener(data);
      });
    },
  };
  host.mountSurface({ ...options, frame });
  return fromWindow(host, frame, listeners, received);
}

/** An iframe the Host did not create: its messages come from an unknown source. */
export function strangerFrame(host: Host): MemoryFrame {
  return fromWindow(host, { postMessage() {} }, new Set(), []);
}

let nextRawId = 0;

function fromWindow(host: Host, source: object, listeners: Set<(data: unknown) => void>, received: unknown[]): MemoryFrame {
  const post = (message: unknown) => {
    const data = structuredClone(message);
    setTimeout(() => host.receive({ source, data }));
  };
  return {
    received,
    post,
    transport: {
      send: post,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    request(type, payload) {
      const id = `raw-${nextRawId++}`;
      return new Promise((resolve) => {
        const listener = (data: any) => {
          if (data?.type === "response" && data.id === id) {
            listeners.delete(listener);
            resolve(data);
          }
        };
        listeners.add(listener);
        post({ tessello: 1, type, id, ...(payload === undefined ? {} : { payload }) });
      });
    },
  };
}

/** Waits until every message already posted has been delivered and handled. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
