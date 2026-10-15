// Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { inject, injectable } from 'inversify';
import { BusinessError } from '@kit.BasicServicesKit';
import { common, Want } from '@kit.AbilityKit';
// dataShare 和 webNativeMessagingExtensionManager 在当前SDK版本中不可用
// import { dataShare } from '@kit.ArkData';
// import { webNativeMessagingExtensionManager } from '@kit.ArkWeb';
import { BaseAdapter } from '../common/BaseAdapter';
import { ContextAdapter } from './ContextAdapter';
import LogMethod from '../common/LogDecorator';
import LogUtil from '../utils/LogUtil';

const TAG: string = 'NativeMessagingAdapter';
const MESSAGE_READ_PIPE: string = 'ohos.arkweb.messageReadPipe';
const MESSAGE_WRITE_PIPE: string = 'ohos.arkweb.messageWritePipe';
const EXTENSION_ORIGIN: string = 'ohos.arkweb.extensionOrigin';
const INVALID_PID: number = -1;

@injectable()
export class NativeMessagingAdapter extends BaseAdapter {
  private ctxAdapter: ContextAdapter;

  constructor(@inject(ContextAdapter) ctxAdapter: ContextAdapter) {
    super();
    this.ctxAdapter = ctxAdapter;
  }

  @LogMethod
  connectNative(commands: Array<string>, fds: Array<number>, callback: (result: number) => void): void {
    // webNativeMessagingExtensionManager 在当前SDK版本中不可用
    LogUtil.warn(TAG, 'connectNative is not available in current SDK version');
    callback(INVALID_PID);
    return;
    /*
    let connectionId: number = -1;
    // 添加回调标志位防止重复调用, 连接失败或连接成功后异常都会触发onFailed
    let hasCallback = false;
    const safeCallback = (pid: number) => {
      if (!hasCallback) {
        hasCallback = true;
        callback(pid);
      }
    };
    let options: webNativeMessagingExtensionManager.WebExtensionConnectionCallback = {
      onConnect(connection: webNativeMessagingExtensionManager.ConnectionNativeInfo) {
        LogUtil.info(TAG, `onConnect callback extensionPid: ${connection.extensionPid},
          connectionId: ${connectionId}`);
        safeCallback(connectionId);
      },
      onDisconnect(connection: webNativeMessagingExtensionManager.ConnectionNativeInfo) {
        LogUtil.info(TAG, 'onDisconnect callback');
      },
      onFailed(code: webNativeMessagingExtensionManager.NmErrorCode, errMsg: string) {
        LogUtil.error(TAG, `onFailed callback, error code: ${code}, errMsg: ${errMsg}`);
        safeCallback(INVALID_PID);
      }
    };
    if (commands.length < 3 || fds.length < 2) {
      LogUtil.error(TAG, 'The parameter is incorrect');
      safeCallback(INVALID_PID);
      return;
    }

    try {
      let want: Want = {
        bundleName: commands[0],
        abilityName: commands[1]
      };
      want.parameters = {};
      let readPipe: Record<string, number | string> = { 'type': 'FD', 'value': fds[1] };
      let writePipe: Record<string, number | string> = { 'type': 'FD', 'value': fds[0] };
      want.parameters[MESSAGE_READ_PIPE] = readPipe;
      want.parameters[MESSAGE_WRITE_PIPE] = writePipe;
      want.parameters[EXTENSION_ORIGIN] = commands[2];

      let activeContext = this.ctxAdapter.getActiveContext() as common.UIAbilityContext;
      if (!activeContext) {
        LogUtil.error(TAG, 'Failed to get active context');
        safeCallback(INVALID_PID);
        return;
      }
      connectionId = webNativeMessagingExtensionManager.connectNative(
        activeContext, want, options);
      LogUtil.info(TAG, `connectNative connectionId: ${connectionId}`);
    } catch (err) {
      LogUtil.error(TAG, `connectNativeMessaging failed, code: ${err?.code}, message: ${err?.message}.`);
      safeCallback(INVALID_PID);
    }
    */
  }

  @LogMethod
  disconnectNative(connectionId: number): void {
    // webNativeMessagingExtensionManager 在当前SDK版本中不可用
    LogUtil.warn(TAG, 'disconnectNative is not available in current SDK version');
    /*
    try {
      LogUtil.info(TAG, `disconnectNative connectionId: ${connectionId}`);
      webNativeMessagingExtensionManager.disconnectNative(connectionId);
    } catch (err) {
      LogUtil.error(TAG, `disconnectNative failed, code: ${err?.code}, message: ${err?.message}`);
    }
    */
  }

  @LogMethod
  getManifestConfig(name: string, callback: (result: string) => void): void {
    // dataShare 在当前SDK版本中不可用
    LogUtil.warn(TAG, 'getManifestConfig is not available in current SDK version');
    callback('');
    return;
    /*
    let ret: string = '';
    dataShare.createDataProxyHandle().then((dsProxyHelper: dataShare.DataProxyHandle) => {
      const urisToGet: string[] =
        [`datashareproxy://${name}/browserNativeMessagingHosts`];
      const config: dataShare.DataProxyConfig = {
        type: dataShare.DataProxyType.SHARED_CONFIG,
      };
      dsProxyHelper.get(urisToGet, config).then((results: dataShare.DataProxyGetResult[]) => {
        for (let i = 0; i < results.length; i++) {
          if (typeof results[i].value !== "string") {
            continue;
          }
          ret = results[i].value as string;
          break;
        };
        LogUtil.info(TAG, `getting config succeeded`);
        callback(ret);
      }).catch((err: BusinessError) => {
        LogUtil.error(TAG, `Error getting config, code: ${err.code}, message: ${err.message}`);
        callback(ret);
      });
    }).catch((err: BusinessError) => {
      LogUtil.error(TAG, `Error creating DataProxyHandle, code: ${err.code}, message: ${err.message}`);
      callback(ret);
    });
    */
  }
}
