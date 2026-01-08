/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import http from 'node:http';
import { logger } from '@main/logger';
import { store } from '@main/store/create';
import { runAgent } from './runAgent';
import { StatusEnum } from '@ui-tars/shared/types';

export interface HttpServerConfig {
  enabled: boolean;
  port: number;
  host: string;
  apiKey?: string;
}

const DEFAULT_CONFIG: HttpServerConfig = {
  enabled: false,
  port: 9527,
  host: '127.0.0.1',
};

class HttpServerService {
  private server: http.Server | null = null;
  private config: HttpServerConfig = DEFAULT_CONFIG;

  setConfig(config: Partial<HttpServerConfig>) {
    this.config = { ...this.config, ...config };

    if (this.server && !this.config.enabled) {
      this.stop();
    } else if (!this.server && this.config.enabled) {
      this.start();
    }
  }

  getConfig(): HttpServerConfig {
    return this.config;
  }

  start() {
    if (this.server) {
      logger.warn('[HttpServer] Server already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('[HttpServer] Server is disabled');
      return;
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.config.port, this.config.host, () => {
      logger.info(
        `[HttpServer] Server started at http://${this.config.host}:${this.config.port}`,
      );
    });

    this.server.on('error', (error) => {
      logger.error('[HttpServer] Server error:', error);
    });
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        logger.info('[HttpServer] Server stopped');
      });
      this.server = null;
    }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const { method, url } = req;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Check API key if configured
    if (this.config.apiKey) {
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey !== this.config.apiKey) {
        this.sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
    }

    // Health check endpoint
    if (method === 'GET' && url === '/health') {
      const { status, thinking } = store.getState();
      this.sendJson(res, 200, {
        status: 'ok',
        agentStatus: status,
        isRunning: thinking,
      });
      return;
    }

    // Get current status endpoint
    if (method === 'GET' && url === '/status') {
      const { status, messages, instructions, thinking } = store.getState();
      this.sendJson(res, 200, {
        status,
        instructions,
        isRunning: thinking,
        messageCount: messages?.length || 0,
      });
      return;
    }

    // Run agent endpoint
    if (method === 'POST' && url === '/run') {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const { instructions, sessionId } = data;

          if (!instructions || typeof instructions !== 'string') {
            this.sendJson(res, 400, {
              error: 'Bad Request',
              message: 'instructions is required and must be a string',
            });
            return;
          }

          const { thinking, status: currentStatus } = store.getState();

          if (thinking || currentStatus === StatusEnum.RUNNING) {
            this.sendJson(res, 409, {
              error: 'Conflict',
              message: 'Agent is already running',
            });
            return;
          }

          // Set instructions and run agent
          store.setState({
            instructions,
            abortController: new AbortController(),
            thinking: true,
            errorMsg: null,
          });

          // Run agent asynchronously (don't wait for completion)
          runAgent(store.setState, store.getState)
            .then(() => {
              store.setState({ thinking: false });
            })
            .catch((error) => {
              logger.error('[HttpServer] runAgent error:', error);
              store.setState({
                thinking: false,
                status: StatusEnum.ERROR,
                errorMsg: error.message,
              });
            });

          this.sendJson(res, 200, {
            success: true,
            message: 'Agent started',
            instructions,
          });
        } catch (error) {
          logger.error('[HttpServer] Error handling /run:', error);
          this.sendJson(res, 500, {
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
      return;
    }

    // Stop agent endpoint
    if (method === 'POST' && url === '/stop') {
      const { abortController } = store.getState();

      store.setState({ status: StatusEnum.END, thinking: false });
      abortController?.abort();

      this.sendJson(res, 200, { success: true, message: 'Agent stopped' });
      return;
    }

    // 404 for unknown routes
    this.sendJson(res, 404, { error: 'Not Found' });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: unknown) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}

export const httpServerService = new HttpServerService();
