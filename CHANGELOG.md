# 更新日志

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## 0.1.0

首个可发布版本，由 `D:\code\dsh-notify\dsh-desktop-notify` 原型（0.1.0，私有、靠 `install.ps1` 手工拷贝安装）重写而来。

### 新增

- 以 bundle 形式发布：`package.json` 里 `dsh.bundle.patch` 指向 `cordis.patch.yml`，装进 profile 即可启用，不再需要手工改 `cordis.patch.yml`。
- 用 `Config`（schemastery）暴露配置：`onInterrupt`、`onDone`、`silent`、`dedupeWindowMs`、`bootQuietMs`、`interruptText`、`doneText`、`appId`，在「设置 → 插件」里直接改。
- `locale/en.json`、`locale/zh.json` 提供插件市场与设置页显示名，`icon.svg` 提供图标。
- 非 Windows 平台尽力而为：macOS 走 `osascript`，Linux 走 `notify-send`；Windows 仍用 PowerShell + WinRT Toast。
- 单元测试（`node:test`），覆盖事件分类、去重、静默期与 toast XML 生成。

### 变更

- 包名由 `dsh-desktop-notify` 改为 `dsh-desktop-toast`：`dsh-desktop-notify` 已是他人发布的插件（crazy118，1.4.1）。
- 行 id 由 `desktop-notify` 改为 `desktop-toast`；插件 `name` 导出同步改名。
- 打断判断抽成纯函数 `classifyEvent`，子会话判断抽成 `isSubagent`，便于测试。
- `bootQuietMs` 语义收紧：只吞掉启动瞬间的「任务完成」，不吞「中断」。

### 移除

- `install.ps1` / `-Uninstall`：改用官方插件管理器安装，不再拷贝目录、不再追加 profile 的 patch 行。
