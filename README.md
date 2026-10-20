# dsh-desktop-toast

DeepSeek Harness 桌面通知插件：**任务被打断**（等你审批、等你回答、计划待确认）和**任务完成**时，弹一条系统原生通知。不用一直盯着窗口。

> 前身是 `dsh-desktop-notify` 0.1.0 原型（靠 `install.ps1` 往 profile 里拷文件）。这版改成标准 bundle，装、配、卸都走官方插件管理器。改名是因为 `dsh-desktop-notify` 已被他人发布。

![Windows 通知中心里的实际弹窗](docs/toast.png)

## 提示时机

| 会话事件 | 通知 | 说明 |
| --- | --- | --- |
| `tool/call` 且工具是 `ask_user_question` / `exit_plan_mode` | 任务中断 · 需要你处理 | 模型在等你回答或确认计划 |
| `approval/asked` | 任务中断 · 需要你处理 | 有操作在等你授权 |
| `turn/end` 且 `reason.kind === 'completed'` | 任务完成 | |
| `turn/end` 且 `reason.kind` 为 `blocked` / `error` / `max-tokens` | 任务中断 · 需要你处理 | 需要你看一眼才能继续 |
| `turn/end` 且 `reason.kind === 'aborted'` | 不提示 | 你自己取消的，不用吵你 |

子会话（subagent）的事件一律忽略，避免一次任务弹一串通知。

## 安装

**官方方式**——和装其它插件一样，二选一：

```powershell
# CLI
dsh plugin --profile desktop add dsh-desktop-toast

# 本地开发时直接指向目录
dsh plugin --profile desktop add D:\code\dsh-notify\dsh-desktop-toast
```

或者开 DSH 桌面端 → 侧边栏「插件」→ 搜索 `dsh-desktop-toast` → 安装。装完立即生效，不用重启。

**不推荐：手工挂行。** 如果你非要不装成 bundle，把 `cordis.patch.yml` 里 `insert` 那两行抄进 `%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml` 即可；`id` 保持唯一。

## 配置

在 profile 的 `cordis.patch.yml` 里按行 id 覆盖 `config`（改完重启 DSH 生效）：

```yaml
- id: desktop-toast
  name: dsh-desktop-toast
  config:
    onDone: false
    dedupeWindowMs: 5000
```

| 键 | 默认值 | 作用 |
| --- | --- | --- |
| `onInterrupt` | `true` | 是否发「任务中断」通知 |
| `onDone` | `true` | 是否发「任务完成」通知 |
| `silent` | `false` | 静音弹出（Windows 上不响提示音） |
| `dedupeWindowMs` | `3000` | 同一种通知在这个窗口内只弹一次（毫秒，`0` 关闭去重） |
| `bootQuietMs` | `3000` | 插件刚加载时，这段时间内的「任务完成」不弹（避免启动就刷屏）；「中断」不受影响 |
| `interruptText` | `任务中断 · 需要你处理` | 中断通知正文 |
| `doneText` | `任务完成` | 完成通知正文 |
| `appId` | `com.deepseek.dsh` | Windows 通知的 AUMID，默认复用 DSH 自己的身份 |

**为什么设置页没有表单？** 这份 `Config` 只负责校验和默认值；DSH 的插件页不会按 schema 自动生成表单，bundle 自己的配置区（`plugins.bundle.config`）要插件自带 Web 端代码去填。本插件是纯宿主插件，所以配置走 `cordis.patch.yml`。

## 平台

- **Windows（主要目标）**：PowerShell 5.1 + WinRT `ToastNotificationManager`，系统通知中心里显示为 DeepSeek Harness。要求系统通知总开关打开、DSH 没被关掉通知。
- **macOS**：`osascript -e 'display notification ...'`，尽力而为，弹窗归属「脚本编辑器」。
- **Linux**：`notify-send`，需要装了 libnotify。

## 已知限制

- Windows 上正文只有一行；标题留空，靠系统显示应用名。
- 每次通知会拉起一个 PowerShell 进程（约几百毫秒），已经 `unref()`，不拖住宿主退出。
- 不支持点通知跳回会话（WinRT 的激活回调要注册 COM 类，宿主侧做不干净）。
- 只对宿主侧会话事件生效；纯 client 侧（浏览器直连）场景没有系统通知。

## 从原型迁移

旧版往 profile 里拷目录、在 `cordis.patch.yml` 尾部追加 `- id: desktop-notify` 行。换到本插件：

1. 删掉 profile 的 `node_modules\dsh-desktop-notify` 目录；
2. 删掉 profile `cordis.patch.yml` 里 `id: desktop-notify` 那一块（含它前面的 `- insert:` 行）；
3. 按上面「安装」装 `dsh-desktop-toast`。

两个插件同时装着会弹两遍，务必先拆旧的。

## 开发

```powershell
cd D:\code\dsh-notify\dsh-desktop-toast
npm install          # 只为跑测试，装 @deepseek-ai/schemastery
npm test             # node --test test
npm pack --dry-run   # 看发布内容
```

改完想在本机验证，用上面的本地目录安装，然后随便发一句话、或让它问个问题试试。

## License

MIT
