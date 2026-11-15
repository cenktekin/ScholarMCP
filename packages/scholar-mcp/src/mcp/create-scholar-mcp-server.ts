import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../config.js';
import { Logger } from '../core/logger.js';
import { ResearchService } from '../research/research-service.js';
import { ScholarService } from '../scholar/scholar-service.js';
import { registerCitationValidationTool, registerContextualCitationTool } from './tools/citation-tools.js';
import {
  registerExtractGranularDetailsTool,
  registerIngestPaperFulltextTool,
  registerIngestionStatusTool
} from './tools/ingestion-tools.js';
import { registerReferenceListTool } from './tools/reference-tools.js';
import {
  registerAuthorInfoTool,
  registerScholarAdvancedSearchTool,
  registerScholarKeywordSearchTool,
  registerSearchLiteratureGraphTool
} from './tools/search-tools.js';
import type { McpToolContext } from './tool-helpers.js';

export const createScholarMcpServer = (
  config: AppConfig,
  service: ScholarService,
  researchService: ResearchService,
  logger: Logger
): McpServer => {
  const server = new McpServer(
    {
      name: config.serverName,
      version: config.serverVersion,
      title: 'ScholarMCP',
      description: 'Google Scholar research tools exposed over MCP'
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  const context: McpToolContext = { config, service, researchService, logger };

  registerSearchLiteratureGraphTool(server, context);
  registerIngestPaperFulltextTool(server, context);
  registerIngestionStatusTool(server, context);
  registerExtractGranularDetailsTool(server, context);
  registerContextualCitationTool(server, context);
  registerReferenceListTool(server, context);
  registerCitationValidationTool(server, context);
  registerScholarKeywordSearchTool(server, context);
  registerScholarAdvancedSearchTool(server, context);
  registerAuthorInfoTool(server, context);

  return server;
};
