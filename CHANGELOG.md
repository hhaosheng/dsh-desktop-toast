# 更新日志

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## 0.1.1

只有文档与注释修正，运行时行为与 0.1.0 完全一致。

### 修正

- 删掉「在设置 → 插件里直接改配置」的错误说法。DSH 的插件页不会按 `Config` schema 自动生成表单，bundle 自己的配置区（插槽 `plugins.bundle.config`）要插件自带 Web 端代码填充；本插件是纯宿主插件，配置需在 profile 的 `cordis.patch.yml` 里按行 id 覆盖 `config`。
- `README.md`、`README.en.md` 补充「为什么设置页没有表单」的说明；`index.js` 中 `Config` 的注释同步纠正。

## 0.1.0

首个可发布版本，由 `D:\code\dsh-notify\dsh-desktop-notify` 原型（0.1.0，私有、靠 `install.ps1` 手工拷贝安装）重写而来。

### 新增

- 以 bundle 形式发布：`package.json` 里 `dsh.bundle.patch` 指向 `cordis.patch.yml`，装进 profile 即可启用，不再需要手工改 `cordis.patch.yml`。
- 用 `Config`（schemastery）暴露配置：`onInterrupt`、`onDone`、`silent`、`dedupeWindowMs`、`bootQuietMs`、`interruptText`、`doneText`、`appId`；改法是在 profile 的 `cordis.patch.yml` 里按行 id 覆盖 `config`。
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
