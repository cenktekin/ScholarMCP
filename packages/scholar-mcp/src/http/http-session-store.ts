import type { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../core/logger.js';

export interface SessionRuntime {
  sessionId: string;
  createdAt: number;
  lastSeenAt: number;
  transport: WebStandardStreamableHTTPServerTransport;
  closeServer: () => Promise<void>;
}

export interface SessionStore {
  readonly size: number;
  get(sessionId: string): SessionRuntime | undefined;
  register(runtime: SessionRuntime): void;
  touch(sessionId: string): void;
  close(sessionId: string, reason: string, closeTransport: boolean): Promise<boolean>;
  pruneExpired(reason: string): Promise<void>;
  evictOldest(): Promise<void>;
  closeAll(reason: string): Promise<void>;
}

const isStale = (runtime: SessionRuntime, now: number, config: AppConfig): boolean =>
  now - runtime.lastSeenAt > config.httpSessionTtlMs;

export const createSessionStore = (config: AppConfig, logger: Logger): SessionStore => {
  const sessions = new Map<string, SessionRuntime>();

  const close = async (sessionId: string, reason: string, closeTransport: boolean): Promise<boolean> => {
    const runtime = sessions.get(sessionId);
    if (!runtime) {
      return false;
    }

    sessions.delete(sessionId);

    if (closeTransport) {
      await runtime.transport.close().catch(() => undefined);
    }

    await runtime.closeServer().catch(() => undefined);

    logger.debug('Closed MCP HTTP session', {
      sessionId,
      reason,
      openSessions: sessions.size
    });

    return true;
  };

  const pruneExpired = async (reason: string): Promise<void> => {
    if (config.httpSessionMode !== 'stateful' || sessions.size === 0) {
      return;
    }

    const now = Date.now();
    const expired = [...sessions.entries()]
      .filter(([, runtime]) => isStale(runtime, now, config))
      .map(([sessionId]) => sessionId);

    await Promise.all(expired.map((sessionId) => close(sessionId, reason, true)));
  };

  const evictOldest = async (): Promise<void> => {
    if (sessions.size < config.httpMaxSessions) {
      return;
    }

    let oldestSessionId: string | null = null;
    let oldestSeen = Number.POSITIVE_INFINITY;

    for (const [sessionId, runtime] of sessions.entries()) {
      if (runtime.lastSeenAt < oldestSeen) {
        oldestSeen = runtime.lastSeenAt;
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      await close(oldestSessionId, 'evicted_capacity', true);
      logger.warn('Evicted oldest HTTP MCP session to respect session limit', {
        maxSessions: config.httpMaxSessions,
        evictedSessionId: oldestSessionId
      });
    }
  };

  return {
    get size() {
      return sessions.size;
    },
    get: (sessionId) => sessions.get(sessionId),
    register: (runtime) => {
      sessions.set(runtime.sessionId, runtime);
    },
    touch: (sessionId) => {
      const runtime = sessions.get(sessionId);
      if (runtime) {
        runtime.lastSeenAt = Date.now();
      }
    },
    close,
    pruneExpired,
    evictOldest,
    closeAll: async (reason) => {
      await Promise.all([...sessions.keys()].map((sessionId) => close(sessionId, reason, true)));
    }
  };
};
