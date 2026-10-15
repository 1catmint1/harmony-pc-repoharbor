# RepoHarbor — Subversion 社区只读仓库浏览适配

固定社区基线：[ohos_subversion 8aa3ca01b55f9ec7f9958cc70f8967adbf6d26e4](https://atomgit.com/OpenHarmonyPCDeveloper/ohos_subversion/tree/8aa3ca01b55f9ec7f9958cc70f8967adbf6d26e4)。本仓库包含新增 DAV 协议、连接配置、异步会话模块及集成补丁，并提供1.0.1发行工程harmony/。既有 Electron 页面、窗口封装、原生运行库和其余社区贡献归属上游作者；不宣称完整移植 Apache SVN 命令行、工作副本、checkout 或 commit。

支持 HTTPS SVN HTTPv2 发现、目录、文本读取、日志及指定版本文本逐行对照。逐行对照不生成合并补丁。TLS 验证默认开启，不向普通 HTTP 发送凭据，不自动跟随跳转，URL 和 DAV href 必须在同源仓库内；XML/文本上限 2 MiB，拒绝 DTD、非法 UTF8，设置绝对超时并支持取消。密码仅保存在主进程会话，不写入连接配置。文件列表与错误文本转义，迟到请求不覆盖新选择。

## 发布范围与许可

新增模块、测试和本次新增代码采用 MIT；saxes 6.0.0 采用 ISC，xmlchars 2.2.0 采用 MIT，原许可保留于 modules/node_modules。1.0.1完整社区前端和ArkTS封装源码在harmony/，其原作者贡献和版权头保留；前端app/package.json的原MIT声明同时保留，ArkTS的BSD-style头及Chromium根BSD许可材料单列。Electron、Chromium、FFmpeg及各依赖保留各自原许可；新增MIT模块不覆盖整个运行库。原生运行库二进制不放入源码仓库。设备绑定的 debug HAP、私钥、证书、Profile 和签名配置均不发布。

## 验证及边界

Windows 主机核心 35/35、实际 renderer 控制 6/6，跳过 0。当前 USB 鸿蒙 PC 的同一签名包、同一次启动、同一 boot/PID/UID 中，实际 GUI 完成五项：Apache 公共 HTTPS 发现、26 项目录、README 正文、50 条日志状态，以及 README r1903577/r1932863 历史版本对照。核心 35 项与 renderer 6 项未在设备上作为单元测试执行，不混同为原生测试数。

签名 HAP SHA256：`aeea7dc1ab1d2138e66fad5a5e33c2bcda761ad0fe981528e74eb03d1cc4d451`，仅用于绑定验收证据，不是可下载发布包。R1 未安装即结束，R2 是 Windows HDC 本地路径打开失败，R3 才是实际安装和一次启动。未验证私有服务器认证、所有 SVN 服务端、超大仓库、二进制文件或原始 SVN 客户端全部功能。当前社区提交、社区审核、AppGallery 审核及正式发布分别记账，验收成功不等于任何平台批准。

## 复现

取得固定基线后，在上游根目录应用 `git apply --unidiff-zero integration/subversion.patch`；将 modules 下三个 cjs 文件和 node_modules 合入 `ohos_hap/web_engine/src/main/resources/resfile/resources/app/`。CodeMirror 5.65.16 必须从官方固定包离线提供并保留原许可；本仓库的 native-asset 摘要仅用于核对自行取得的运行库。

主机测试使用 Node 18 或更高版本。设置 `REPOHARBOR_APP_DIR` 为完成集成的 app 目录；设置 `REPOHARBOR_TLS_FIXTURE_DIR` 为自行生成的 localhost 测试证书目录，包含 test-localhost.crt 和 test-localhost.key，证书 SAN 包含 IP:127.0.0.1，仅用于测试，不得加入版本库。执行 `npm test` 和 `npm run test:renderer`。核心控制中有自签 TLS 默认拒绝及显式测试 CA 成功，未关闭证书校验。

Windows DevEco SDK API22/model5.1 的隔离投影可构建 ARM64 HAP，权限仅 INTERNET 与 PREPARE_APP_TERMINATE。使用自己的包名和本机调试签名；不要复用上游或本次验收的签名材料。


## 1.0.1 发行构建

使用harmony/，不是历史自动验收投影。PC ARM64/SDK22，1.0.1/1000001；仅INTERNET与PREPARE_APP_TERMINATE，两个权限直接声明于entry，HAR声明不会自动进入最终entry。R4发现EPERM且最终权限空，失败保留；修复后R5实际读取26目录项、README和历史文本对照。R6补入依赖许可后重新绑定真机，R8同步本机HAR副本后验证通知分页与只读功能，实际结果见evidence/native-release-r8-verification.json。历史35项主机核心和6项renderer控制没有作为R8单元测试重跑。

公开工程不包含任何签名资料、设备HAP或原生运行库。固定社区基线的原生4库SHA见evidence/native-asset-receipts.json，运行资源来源和许可见RUNTIME-SOURCE.md。用合法取得、匹配摘要的原库填入harmony/electron/libs/arm64-v8a，用匹配的运行资源填入harmony/web_engine/src/main/resources/resfile，保留本仓库resources/app/源码及许可。重建前自行核对来源、使用自己的签名。ohpm install --all --no-link --max_concurrent 1，hvigorw assembleApp --mode project -p product=default -p buildMode=release --no-daemon --no-parallel --max-workers 2。

正式APP/HAP通过官方验签，与R8包的代码/资源/运行库载荷逐项比对；正式发行签名本身没有直接安装到USB。平台提审和最终批准单独记账，本仓库不声称已经批准上架。
