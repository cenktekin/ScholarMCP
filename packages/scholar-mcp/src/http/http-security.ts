import type { AppConfig } from '../config.js';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

const normalizeHostHeader = (hostHeader: string): { full: string; hostname: string } => {
  const normalized = hostHeader.trim().toLowerCase();
  const withoutPort = normalized.startsWith('[')
    ? normalized.replace(/^\[([^\]]+)\](?::\d+)?$/, '$1')
    : normalized.replace(/:\d+$/, '');

  return {
    full: normalized,
    hostname: withoutPort
  };
};

const isLoopbackOrigin = (origin: string): boolean => {
  try {
    const parsed = new URL(origin);
    return LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const isHostAllowed = (hostHeader: string, config: AppConfig): boolean => {
  if (!hostHeader) {
    return false;
  }

  const host = normalizeHostHeader(hostHeader);

  if (config.allowedHosts.length > 0) {
    return config.allowedHosts.includes(host.full) || config.allowedHosts.includes(host.hostname);
  }

  if (LOCAL_HOSTS.has(config.host.toLowerCase())) {
    return LOCAL_HOSTS.has(host.hostname);
  }

  return true;
};

export const isOriginAllowed = (origin: string | undefined, config: AppConfig): boolean => {
  if (!origin) {
    return true;
  }

  if (config.allowedOrigins.length > 0) {
    return config.allowedOrigins.includes(origin);
  }

  if (LOCAL_HOSTS.has(config.host.toLowerCase())) {
    return isLoopbackOrigin(origin);
  }

  return true;
};

export const isAuthorized = (authorization: string | undefined, config: AppConfig): boolean => {
  if (!config.apiKey) {
    return true;
  }

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return false;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 && token === config.apiKey;
};

export const attachCorsHeaders = (response: Response, origin: string | undefined): Response => {
  if (!origin) {
    return response;
  }

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, mcp-session-id, MCP-Protocol-Version, Last-Event-ID'
  );
  response.headers.set('Access-Control-Expose-Headers', 'mcp-session-id, MCP-Protocol-Version');
  response.headers.set('Vary', 'Origin');
  return response;
};
