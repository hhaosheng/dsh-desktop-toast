// dsh-desktop-toast —— 任务中断 / 任务完成 的系统弹窗（纯宿主侧 Cordis 插件）。
//
// 只做两件事：辨识「需要你处理」与「这一轮做完了」，然后弹一条系统通知。
// 不读会话标题、不发客户端 bundle、不入模型上下文。
//
// 平台：Windows 走 WinRT Toast（Windows PowerShell 5.1）、macOS 走 osascript、
// Linux 走 notify-send；都没有时静默失败，绝不影响任务本身。
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import Schema from '@deepseek-ai/schemastery'

export const name = 'desktop-toast'

/** DSH 桌面版在开始菜单快捷方式里注册的 AppUserModelID，弹窗因此显示为「DeepSeek Harness」。 */
export const DEFAULT_APP_ID = 'com.deepseek.dsh'

/** 非 Windows 平台没有 AUMID，用应用名当通知标题。 */
const APP_TITLE = 'DeepSeek Harness'

/** 会停下来等人的工具：向用户提问、以及计划审阅。 */
const ASK_TOOLS = new Set(['ask_user_question', 'exit_plan_mode'])

/** 视为「仍然需要你处理」的 turn/end 结局；`aborted`（你自己取消）不提示。 */
const INTERRUPT_REASONS = new Set(['blocked', 'error', 'max-tokens'])

/**
 * 可调项。schema 会出现在 DSH 设置页里，也能写进 insert 行的 `config:` 下；
 * 插件内部会再校验一次，所以不写 config 也能跑。
 */
export const Config = Schema.object({
  onInterrupt: Schema.boolean()
    .default(true)
    .description('等待审批 / 提问 / 计划审阅 / 受阻时报「中断」'),
  onDone: Schema.boolean()
    .default(true)
    .description('一轮任务正常做完时报「完成」'),
  silent: Schema.boolean()
    .default(false)
    .description('静音弹窗（Windows：不播提示音）'),
  dedupeWindowMs: Schema.number()
    .default(3000)
    .min(0)
    .description('同类弹窗的最小间隔（毫秒），防止连弹'),
  bootQuietMs: Schema.number()
    .default(3000)
    .min(0)
    .description('插件刚加载后的静默期（毫秒），避免会话回放触发「完成」'),
  appId: Schema.string()
    .default(DEFAULT_APP_ID)
    .description('Windows AppUserModelID（DSH 桌面版已注册，通常不用改）'),
  interruptText: Schema.string()
    .default('任务中断 · 需要你处理')
    .description('「中断」弹窗正文'),
  doneText: Schema.string()
    .default('任务完成')
    .description('「完成」弹窗正文'),
})

const POWERSHELL = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`

/** AUMID 只允许字母数字和 `._-`：它会被拼进 PowerShell 源码，不接受任意字符串。 */
const SAFE_APP_ID = /^[A-Za-z0-9._-]+$/

export function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[ch])
}

/** AppleScript 字符串字面量：反斜杠和双引号转义即可。 */
function appleScriptString(text) {
  return `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** 组装 ToastGeneric 的 XML。空行会被丢掉，所以没标题时只有一行正文。 */
export function toastXml({ body, title = '', silent = false } = {}) {
  const lines = [title, body]
    .filter((line) => typeof line === 'string' && line.length > 0)
    .map((line) => `<text>${escapeXml(line)}</text>`)
    .join('')
  return '<toast duration="short"'
    + (silent ? ' silent="true"' : '')
    + '><visual><binding template="ToastGeneric">'
    + lines
    + '</binding></visual></toast>'
}

/** Windows 侧脚本：WinRT Toast 只有 Windows PowerShell 5.1 能用，pwsh 7 不行。 */
export function powershellScript({ body, title = '', silent = false, appId = DEFAULT_APP_ID } = {}) {
  const id = SAFE_APP_ID.test(appId) ? appId : DEFAULT_APP_ID
  const payload = Buffer.from(toastXml({ body, title, silent }), 'utf8').toString('base64')
  return [
    "$ErrorActionPreference = 'Stop'",
    '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
    '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null',
    `$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))`,
    '$doc = New-Object Windows.Data.Xml.Dom.XmlDocument',
    '$doc.LoadXml($text)',
    '$toast = New-Object Windows.UI.Notifications.ToastNotification $doc',
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${id}').Show($toast)`,
  ].join('; ')
}

/**
 * 当前平台弹一条通知要执行的命令。抽成纯函数，测试里可以直接断言参数。
 * `title` 为空时按各平台习惯省略。
 */
export function notificationCommand({ body, title = '', silent = false, appId = DEFAULT_APP_ID } = {}) {
  const heading = process.platform === 'win32' ? title : (title || APP_TITLE)
  if (process.platform === 'win32') {
    const encoded = Buffer.from(
      powershellScript({ body, title, silent, appId }),
      'utf16le',
    ).toString('base64')
    const executable = existsSync(POWERSHELL) ? POWERSHELL : 'powershell.exe'
    return {
      executable,
      args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
    }
  }
  if (process.platform === 'darwin') {
    const script = [
      `display notification ${appleScriptString(body)}`,
      heading ? `with title ${appleScriptString(heading)}` : '',
    ].filter(Boolean).join(' ')
    return { executable: 'osascript', args: ['-e', script] }
  }
  const positional = heading ? [heading, body] : [body]
  return {
    executable: 'notify-send',
    // `-a` 是通知里显示的应用名，用人类可读的名字，别把 AUMID 露给用户。
    args: ['-a', APP_TITLE, ...positional],
  }
}

/**
 * 弹一条系统通知。失败一律静默，绝不打扰任务本身。
 *
 * 注意不要用 `detached: true`：Windows 上那会带上 DETACHED_PROCESS，powershell.exe 会
 * 立刻以退出码 0 结束、脚本根本不执行（表现为「一切正常但没弹窗」）。
 *
 * @returns {boolean} 是否已经派发出去（不代表系统真的显示了）。
 */
export function showToast(text, options = {}) {
  const body = String(text ?? '')
  if (!body) return false
  const { executable, args } = notificationCommand({
    body,
    title: typeof options.title === 'string' ? options.title : '',
    silent: options.silent === true,
    appId: typeof options.appId === 'string' ? options.appId : DEFAULT_APP_ID,
  })
  try {
    spawn(executable, args, { stdio: 'ignore', windowsHide: true })
      .on('error', () => {})
      .unref()
  } catch {
    return false
  }
  return true
}

/** 子智能体有自己的会话，它们结束不代表你那个任务结束。 */
export function isSubagent(session) {
  const header = session?.header
  return header?.parentSession !== undefined || header?.origin === 'subagent'
}

/**
 * 把一条会话事件归类成 `'interrupt' | 'done' | null`。
 *
 * 事件是信封结构：类型在 `event.type`，负载在 `event.data`。
 * 这些信号和驱动侧边栏状态点的是同一路事件，所以弹窗时机和你看到的提示一致。
 */
export function classifyEvent(event) {
  if (!event || typeof event !== 'object') return null
  const data = event.data ?? {}
  switch (event.type) {
    // 需要你处理：向用户提问 / 计划审阅。
    case 'tool/call':
      return typeof data.name === 'string' && ASK_TOOLS.has(data.name) ? 'interrupt' : null
    // 需要你处理：工具调用要申请权限。
    case 'approval/asked':
      return 'interrupt'
    // 一轮结束：正常做完 → 完成；受阻 / 报错 / 触顶 → 中断（同样在等你）。
    case 'turn/end': {
      const kind = data.reason?.kind
      if (kind === 'completed') return 'done'
      return INTERRUPT_REASONS.has(kind) ? 'interrupt' : null
    }
    default:
      return null
  }
}

/**
 * 去重 + 静默期的通知器。`deps` 让测试可以注入假时钟和假的 showToast。
 * @returns {(kind: 'interrupt' | 'done') => boolean}
 */
export function createNotifier(options, deps = {}) {
  const show = deps.show ?? showToast
  const now = deps.now ?? Date.now
  const startedAt = now()
  const lastShownAt = new Map()

  return function notify(kind) {
    if (kind !== 'interrupt' && kind !== 'done') return false
    if (kind === 'interrupt' && options.onInterrupt === false) return false
    if (kind === 'done' && options.onDone === false) return false
    // 插件刚加载时可能回放历史会话，短暂安静期避免开机就弹一堆（只影响「完成」）。
    if (kind === 'done' && now() - startedAt < options.bootQuietMs) return false
    const at = now()
    if (at - (lastShownAt.get(kind) ?? -Infinity) < options.dedupeWindowMs) return false
    lastShownAt.set(kind, at)
    return show(kind === 'interrupt' ? options.interruptText : options.doneText, {
      silent: options.silent,
      appId: options.appId,
    })
  }
}

export function apply(ctx, config = {}) {
  const options = Config(config ?? {})
  const notify = createNotifier(options)

  ctx.on('session/event', (session, event) => {
    if (isSubagent(session)) return
    const kind = classifyEvent(event)
    if (kind) notify(kind)
  }, { global: true })
}
