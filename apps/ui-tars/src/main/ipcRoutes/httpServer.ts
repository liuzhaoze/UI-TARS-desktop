/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { initIpc } from '@ui-tars/electron-ipc/main';
import { httpServerService } from '@main/services/httpServer';
import { SettingStore } from '@main/store/setting';

const t = initIpc.create();

export const httpServerRoute = t.router({
  getHttpServerConfig: t.procedure.input<void>().handle(async () => {
    return httpServerService.getConfig();
  }),
  setHttpServerConfig: t.procedure
    .input<{
      enabled?: boolean;
      port?: number;
      host?: string;
      apiKey?: string;
    }>()
    .handle(async ({ input }) => {
      const { enabled, port, host, apiKey } = input;

      // Update settings store for persistence
      if (enabled !== undefined) {
        SettingStore.set('httpServerEnabled', enabled);
      }
      if (port !== undefined) {
        SettingStore.set('httpServerPort', port);
      }
      if (host !== undefined) {
        SettingStore.set('httpServerHost', host);
      }
      if (apiKey !== undefined) {
        SettingStore.set('httpServerApiKey', apiKey);
      }

      httpServerService.setConfig(input);
      return httpServerService.getConfig();
    }),
  startHttpServer: t.procedure.input<void>().handle(async () => {
    const config = SettingStore.getStore();
    httpServerService.setConfig({
      enabled: true,
      port: config.httpServerPort,
      host: config.httpServerHost,
      apiKey: config.httpServerApiKey,
    });
    SettingStore.set('httpServerEnabled', true);
    return httpServerService.getConfig();
  }),
  stopHttpServer: t.procedure.input<void>().handle(async () => {
    httpServerService.setConfig({ enabled: false });
    SettingStore.set('httpServerEnabled', false);
    return { success: true };
  }),
});
