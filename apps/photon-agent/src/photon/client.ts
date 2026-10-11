import type { Message, Space } from "spectrum-ts" with { "resolution-mode": "import" };
import { loadConfig } from "../config";
import type { PhotonAgentConfig } from "../config";
import { logger } from "../logger";
import type { Logger } from "../logger";

export type { Message, Space } from "spectrum-ts" with { "resolution-mode": "import" };

/** The subset of Spectrum used by this worker; injectable for offline tests. */
export interface PhotonRuntime {
  messages: AsyncIterable<[Space, Message]>;
  send(space: Space, text: string): Promise<Message | undefined>;
  stop(): Promise<void>;
  createDirectSpace?(senderId: string, sourceSpace: Space): Promise<Space>;
}
export interface PhotonClientOptions {
  connect?: (config: PhotonAgentConfig) => Promise<PhotonRuntime>;
  logger?: Logger;
}
export interface PhotonClient {
  /** Inbound iMessage events only; consume with for await (const [space, message] ...). */
  readonly messages: AsyncIterable<[Space, Message]>;
  readonly closed: boolean;
  sendText(space: Space, text: string): Promise<Message | undefined>;
  reply(message: Message, text: string): Promise<Message | undefined>;
  sendDirectText(senderId: string, text: string, sourceSpace: Space): Promise<Message | undefined>;
  stop(): Promise<void>;
}

async function connectSpectrum(config: PhotonAgentConfig): Promise<PhotonRuntime> {
  // Dynamic imports support this CommonJS worker with Spectrum's ESM package.
  const [{ Spectrum }, { imessage }] = await Promise.all([
    import("spectrum-ts"), import("spectrum-ts/providers/imessage"),
  ]);
  const app = await Spectrum({
    projectId: config.photonProjectId,
    // PHOTON_API_KEY contains the Spectrum project secret, not a line token.
    projectSecret: config.photonApiKey,
    providers: [imessage.config()],
    telemetry: false,
    options: { flattenGroups: true, logLevel: "error" },
  });
  const provider = imessage(app);
  return {
    messages: app.messages,
    send: (space, text) => app.send(space, text),
    stop: () => app.stop(),
    createDirectSpace: (senderId, sourceSpace) => provider.space.create(senderId, {
      phone: imessage(sourceSpace).phone,
    }),
  };
}

/** Initialize one connection; importing this module never opens a connection. */
export async function createPhotonClient(
  config: PhotonAgentConfig,
  options: PhotonClientOptions = {},
): Promise<PhotonClient> {
  const log = options.logger ?? logger;
  if (!config.photonProjectId.trim() || !config.photonApiKey.trim()) {
    throw new Error("Photon project ID and project secret are required");
  }
  log.info("photon.connecting");
  let runtime: PhotonRuntime;
  try { runtime = await (options.connect ?? connectSpectrum)(config); }
  catch (error) {
    log.error("photon.connection_failed", { error });
    throw new Error("Unable to initialize Photon Spectrum");
  }
  log.info("photon.initialized");
  let closed = false;
  let stopping: Promise<void> | undefined;
  const assertOpen = (): void => {
    if (closed || stopping) throw new Error("Photon client is stopped or stopping");
  };
  const validateText = (text: string): void => {
    if (typeof text !== "string" || !text.trim()) throw new TypeError("Reply text must be nonempty");
  };
  const messages: AsyncIterable<[Space, Message]> = {
    async *[Symbol.asyncIterator]() {
      assertOpen();
      try {
        for await (const [space, message] of runtime.messages) {
          if (closed || stopping) break;
          if (message.platform !== "imessage" || message.direction !== "inbound") continue;
          yield [space, message];
        }
      } catch (error) {
        if (!closed && !stopping) {
          log.error("photon.stream_failed", { error });
          throw new Error("Photon incoming message stream failed");
        }
      }
    },
  };
  return Object.freeze({
    messages,
    get closed() { return closed; },
    async sendText(space: Space, text: string) {
      assertOpen();
      validateText(text);
      if (space.__platform !== "imessage") throw new TypeError("Expected an iMessage conversation");
      try { return await runtime.send(space, text); }
      catch (error) {
        log.error("photon.send_failed", { conversationId: space.id, error });
        throw new Error("Unable to send Photon text message");
      }
    },
    async reply(message: Message, text: string) {
      assertOpen();
      validateText(text);
      if (message.platform !== "imessage" || message.direction !== "inbound") {
        throw new TypeError("Replies require an inbound iMessage");
      }
      try { return await message.reply(text); }
      catch (error) {
        log.error("photon.reply_failed", { conversationId: message.space.id, error });
        throw new Error("Unable to send Photon reply");
      }
    },
    async sendDirectText(senderId: string, text: string, sourceSpace: Space) {
      assertOpen();
      validateText(text);
      if (!senderId.trim() || sourceSpace.__platform !== "imessage") {
        throw new TypeError("Private delivery requires a sender and iMessage source conversation");
      }
      if (!runtime.createDirectSpace) throw new Error("Private iMessage delivery is unavailable");
      try {
        const direct = await runtime.createDirectSpace(senderId.trim(), sourceSpace);
        if (direct.__platform !== "imessage" || (direct as Space & { type?: unknown }).type !== "dm") {
          throw new Error("Private delivery did not resolve a direct conversation");
        }
        assertOpen();
        return await runtime.send(direct, text);
      } catch (error) {
        log.error("photon.private_send_failed", { error });
        throw new Error("Unable to send private Photon text message");
      }
    },
    stop(): Promise<void> {
      if (closed) return Promise.resolve();
      if (!stopping) {
        log.info("photon.stopping");
        stopping = Promise.resolve().then(() => runtime.stop()).then(() => {
          closed = true;
          log.info("photon.stopped");
        }).catch(error => {
          stopping = undefined;
          log.error("photon.stop_failed", { error });
          throw new Error("Unable to stop Photon client");
        });
      }
      return stopping;
    },
  });
}

let singleton: Promise<PhotonClient> | undefined;
let project: { id: string; secret: string } | undefined;

/** Reuse one initialized client across handlers; concurrent calls share initialization. */
export async function getPhotonClient(
  config: PhotonAgentConfig = loadConfig(),
  options: PhotonClientOptions = {},
): Promise<PhotonClient> {
  if (project && (project.id !== config.photonProjectId || project.secret !== config.photonApiKey)) {
    throw new Error("Stop the Photon client before switching project credentials");
  }
  if (!singleton) {
    project = { id: config.photonProjectId, secret: config.photonApiKey };
    singleton = createPhotonClient(config, options).catch(error => {
      singleton = undefined;
      project = undefined;
      throw error;
    });
  }
  const current = singleton;
  const client = await current;
  if (client.closed) {
    if (singleton === current) { singleton = undefined; project = undefined; }
    return getPhotonClient(config, options);
  }
  return client;
}

/** Call from the worker's SIGINT/SIGTERM shutdown handler. */
export async function stopPhotonClient(): Promise<void> {
  const current = singleton;
  if (!current) return;
  const client = await current;
  await client.stop();
  if (singleton === current) { singleton = undefined; project = undefined; }
}
