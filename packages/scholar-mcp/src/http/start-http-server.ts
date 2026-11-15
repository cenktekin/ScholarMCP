import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { Hono } from 'hono';
import type { AppConfig } from '../config.js';
import { Logger } from '../core/logger.js';
import { createScholarMcpServer } from '../mcp/create-scholar-mcp-server.js';
import type { ResearchService } from '../research/research-service.js';
import type { ScholarService } from '../scholar/scholar-service.js';
import { attachCorsHeaders, isAuthorized, isHostAllowed, isOriginAllowed } from './http-security.js';
import { createSessionStore } from './http-session-store.js';

interface TransportResolution {
  transport: WebStandardStreamableHTTPServerTransport;
  closeServer: () => Promise<void>;
  parsedBody?: unknown;
  closeAfterRequest: boolean;
  closeIfUninitialized: boolean;
}

interface HttpAppRuntime {
  app: Hono;
  shutdown: () => Promise<void>;
}

const MCP_SESSION_HEADER = 'mcp-session-id';

export const createHttpApp = (
  config: AppConfig,
  service: ScholarService,
  researchService: ResearchService,
  logger: Logger
): HttpAppRuntime => {
  const app = new Hono();
  const sessionStore = createSessionStore(config, logger);

  const createSessionRuntime = async (): Promise<TransportResolution> => {
    await sessionStore.evictOldest();

    const server = createScholarMcpServer(config, service, researchService, logger);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        const now = Date.now();
        sessionStore.register({
          sessionId,
          createdAt: now,
          lastSeenAt: now,
          transport,
          closeServer: async () => server.close().catch(() => undefined)
        });

        logger.debug('Initialized MCP HTTP session', {
          sessionId,
          openSessions: sessionStore.size
        });
      },
      onsessionclosed: (sessionId) => {
        void sessionStore.close(sessionId, 'client_delete', false);
      }
    });

    await server.connect(transport);

    return {
      transport,
      closeServer: async () => server.close().catch(() => undefined),
      closeAfterRequest: false,
      closeIfUninitialized: true
    };
  };

  const createStatelessRuntime = async (): Promise<TransportResolution> => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    const server = createScholarMcpServer(config, service, researchService, logger);
    await server.connect(transport);

    return {
      transport,
      closeServer: async () => server.close().catch(() => undefined),
      closeAfterRequest: true,
      closeIfUninitialized: false
    };
  };

  const resolveTransport = async (request: Request): Promise<TransportResolution | Response> => {
    if (config.httpSessionMode === 'stateless') {
      return createStatelessRuntime();
    }

    await sessionStore.pruneExpired('ttl_expired');

    const method = request.method.toUpperCase();
    const sessionId = request.headers.get(MCP_SESSION_HEADER)?.trim();

    if (sessionId) {
      const runtime = sessionStore.get(sessionId);
      if (!runtime) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      sessionStore.touch(sessionId);
      return {
        transport: runtime.transport,
        closeServer: runtime.closeServer,
        closeAfterRequest: false,
        closeIfUninitialized: false
      };
    }

    if (method !== 'POST') {
      return Response.json({ error: 'Missing mcp-session-id header' }, { status: 400 });
    }

    let parsedBody: unknown;
    try {
      parsedBody = await request.clone().json();
    } catch {
      return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    if (!isInitializeRequest(parsedBody)) {
      return Response.json({ error: 'Expected an initialize request when mcp-session-id is absent' }, { status: 400 });
    }

    const runtime = await createSessionRuntime();
    return {
      ...runtime,
      parsedBody
    };
  };

  app.onError((error, c) => {
    logger.error('Unhandled HTTP runtime error', {
      error: error instanceof Error ? error.message : String(error)
    });

    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      },
      500
    );
  });

  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  app.get('/', (c) =>
    c.json({
      name: config.serverName,
      version: config.serverVersion,
      transport: 'streamable-http',
      endpoint: config.endpointPath,
      health: config.healthPath,
      sessionMode: config.httpSessionMode
    })
  );

  app.get(config.healthPath, (c) =>
    c.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      serverName: config.serverName,
      serverVersion: config.serverVersion,
      transport: 'http',
      sessionMode: config.httpSessionMode,
      openSessions: sessionStore.size,
      timestamp: new Date().toISOString()
    })
  );

  app.use(config.endpointPath, async (c, next) => {
    const hostHeader = c.req.header('host') ?? '';
    const origin = c.req.header('origin');
    const authorization = c.req.header('authorization');

    if (!isHostAllowed(hostHeader, config)) {
      return attachCorsHeaders(c.json({ error: 'Forbidden host header' }, 403), origin);
    }

    if (!isOriginAllowed(origin, config)) {
      return attachCorsHeaders(c.json({ error: 'Forbidden origin' }, 403), origin);
    }

    if (c.req.method !== 'OPTIONS' && !isAuthorized(authorization, config)) {
      return attachCorsHeaders(c.json({ error: 'Unauthorized' }, 401), origin);
    }

    await next();
  });

  app.options(config.endpointPath, (c) => {
    const origin = c.req.header('origin');
    const response = new Response(null, { status: 204 });
    return attachCorsHeaders(response, origin);
  });

  app.all(config.endpointPath, async (c) => {
    const origin = c.req.header('origin');

    const resolved = await resolveTransport(c.req.raw);
    if (resolved instanceof Response) {
      return attachCorsHeaders(resolved, origin);
    }

    const { transport, parsedBody, closeAfterRequest, closeIfUninitialized, closeServer } = resolved;
    let response: Response;

    try {
      response = await transport.handleRequest(c.req.raw, parsedBody === undefined ? undefined : { parsedBody });
    } catch (error) {
      logger.error('MCP HTTP request handling failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      response = Response.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        },
        { status: 500 }
      );
    } finally {
      if (closeAfterRequest) {
        await transport.close().catch(() => undefined);
        await closeServer();
      }

      if (closeIfUninitialized && !transport.sessionId) {
        await transport.close().catch(() => undefined);
        await closeServer();
      }
    }

    return attachCorsHeaders(response, origin);
  });

  return {
    app,
    shutdown: async () => {
      await sessionStore.closeAll('server_shutdown');
    }
  };
};

export const startHttpServer = (
  config: AppConfig,
  service: ScholarService,
  researchService: ResearchService,
  logger: Logger
) => {
  const runtime = createHttpApp(config, service, researchService, logger);

  const server = serve(
    {
      fetch: runtime.app.fetch,
      port: config.port,
      hostname: config.host
    },
    (info) => {
      logger.info('ScholarMCP HTTP transport listening', {
        host: config.host,
        port: info.port,
        endpoint: config.endpointPath,
        health: config.healthPath,
        sessionMode: config.httpSessionMode
      });
    }
  );

  const shutdown = (signal: string) => {
    logger.info('Shutting down HTTP transport', { signal });
    server.close();
    void runtime.shutdown();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
};
