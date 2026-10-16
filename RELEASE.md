# RepoHarbor 1.0.2

统一桌面、Ability、Electron应用和主窗口的 RepoHarbor 品牌名称，保留原有连接配置目录。清理社区模板继承的外部包快捷方式入口，正式模块已核对不再注册该入口。

2026-10-16，USB鸿蒙PC R9通过实际生产界面连接 Apache 官方公开HTTPS SVN仓库，测试连接确认HTTPv2和HEAD r1939153，浏览26项目录、85行README、50条日志，并实际读取r1903577与r1932863的README逐行对照。隐私及开源告知窗口显示1.0.2，既有连接配置在更新后仍可读取。106.56秒连续真机录屏覆盖上述仓库操作，已去除音轨和系统Dock。

正式HAP/APP经官方工具验签，为release/app_gallery类型，无设备绑定及额外ACL；81项运行时文件与已验收R9包逐字节相同，APP内HAP也一致。权限保持INTERNET和PREPARE_APP_TERMINATE。验收应用进程已按boot/PID/UID绑定释放。

APP SHA256：e6f6622347a6d9d38748cce15236c03a8aeb2c6604eba3744e65eb721ab80537

当前版本保留社区前端、Electron、Chromium、FFmpeg、ArkTS依赖及解析器的原许可和完整告知；对应源码及重建材料见RUNTIME-SOURCE.md与third_party。上传、提审和发布状态分别以开发者中心回执记录。

复现：连接名称任意，地址为 https://svn.apache.org/repos/asf/subversion/trunk/ ，此公开只读仓库用户名及密码留空，先测试连接、保存，再从连接下拉框选择。真实服务的HEAD及目录可能随上游更新。
