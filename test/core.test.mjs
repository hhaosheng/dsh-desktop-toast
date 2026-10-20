import test from 'node:test'
import assert from 'node:assert/strict'

import {
  Config,
  DEFAULT_APP_ID,
  classifyEvent,
  escapeXml,
  isSubagent,
  notificationCommand,
  powershellScript,
  showToast,
  toastXml,
} from '../index.js'

test('Config 有一份完整默认值', () => {
  const options = Config({})
  assert.equal(options.onInterrupt, true)
  assert.equal(options.onDone, true)
  assert.equal(options.silent, false)
  assert.equal(options.dedupeWindowMs, 3000)
  assert.equal(options.bootQuietMs, 3000)
  assert.equal(options.appId, DEFAULT_APP_ID)
  assert.equal(options.interruptText, '任务中断 · 需要你处理')
  assert.equal(options.doneText, '任务完成')
})

test('Config 接受与修正用户输入', () => {
  assert.equal(Config({ onDone: false }).onDone, false)
  assert.equal(Config({ dedupeWindowMs: 250 }).dedupeWindowMs, 250)
  assert.throws(() => Config({ dedupeWindowMs: -1 }))
})

test('escapeXml 转义 XML 元字符', () => {
  assert.equal(escapeXml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;')
})

test('toastXml 只有正文时是单行文本', () => {
  const xml = toastXml({ body: '任务完成' })
  assert.equal(
    xml,
    '<toast duration="short"><visual><binding template="ToastGeneric">'
      + '<text>任务完成</text></binding></visual></toast>',
  )
})

test('toastXml 支持标题、静音，并转义正文', () => {
  const xml = toastXml({ title: 'DeepSeek Harness', body: 'a & b', silent: true })
  assert.match(xml, /^<toast duration="short" silent="true">/)
  assert.match(xml, /<text>DeepSeek Harness<\/text><text>a &amp; b<\/text>/)
})

test('toastXml 丢掉空标题', () => {
  assert.doesNotMatch(toastXml({ title: '', body: 'x' }), /<text><\/text>/)
})

test('powershellScript 内嵌 base64 的 UTF-8 Toast XML', () => {
  const script = powershellScript({ body: '任务完成', silent: false })
  const payload = /FromBase64String\('([^']*)'\)/.exec(script)?.[1]
  assert.ok(payload, 'script embeds a base64 payload')
  assert.equal(Buffer.from(payload, 'base64').toString('utf8'), toastXml({ body: '任务完成' }))
})

test('powershellScript 用 AUMID 建通知器', () => {
  assert.match(powershellScript({ body: 'x' }), /CreateToastNotifier\('com\.deepseek\.dsh'\)/)
})

test('powershellScript 拒绝会把引号带进 PowerShell 源码的 appId', () => {
  const script = powershellScript({ body: 'x', appId: "x'); Remove-Item C:\\ #" })
  assert.match(script, /CreateToastNotifier\('com\.deepseek\.dsh'\)/)
  assert.doesNotMatch(script, /Remove-Item/)
})

test('notificationCommand 在 Windows 上用 Windows PowerShell 5.1 跑 EncodedCommand', { skip: process.platform !== 'win32' }, () => {
  const { executable, args } = notificationCommand({ body: '任务完成' })
  assert.match(executable, /powershell\.exe$/i)
  assert.ok(args.includes('-NoProfile'))
  assert.equal(args.at(-2), '-EncodedCommand')
  const decoded = Buffer.from(args.at(-1), 'base64').toString('utf16le')
  assert.match(decoded, /ToastNotificationManager/)
})

test('notificationCommand 在非 Windows 平台不回落到 PowerShell', { skip: process.platform === 'win32' }, () => {
  const { executable } = notificationCommand({ body: 'x' })
  assert.ok(['osascript', 'notify-send'].includes(executable))
})

test('showToast 拒绝空正文', () => {
  assert.equal(showToast(''), false)
  assert.equal(showToast(undefined), false)
})

test('isSubagent 认 parentSession 和 origin', () => {
  assert.equal(isSubagent({ header: {} }), false)
  assert.equal(isSubagent({}), false)
  assert.equal(isSubagent(undefined), false)
  assert.equal(isSubagent({ header: { parentSession: 's1' } }), true)
  assert.equal(isSubagent({ header: { origin: 'subagent' } }), true)
})

test('classifyEvent：提问 / 计划审阅 / 申请权限都算中断', () => {
  assert.equal(classifyEvent({ type: 'tool/call', data: { name: 'ask_user_question' } }), 'interrupt')
  assert.equal(classifyEvent({ type: 'tool/call', data: { name: 'exit_plan_mode' } }), 'interrupt')
  assert.equal(classifyEvent({ type: 'approval/asked', data: {} }), 'interrupt')
})

test('classifyEvent：普通工具调用不提示', () => {
  assert.equal(classifyEvent({ type: 'tool/call', data: { name: 'bash' } }), null)
  assert.equal(classifyEvent({ type: 'tool/call', data: {} }), null)
})

test('classifyEvent：turn/end 的结局映射', () => {
  const kind = (value) => classifyEvent({ type: 'turn/end', data: { turn: 1, reason: { kind: value } } })
  assert.equal(kind('completed'), 'done')
  assert.equal(kind('blocked'), 'interrupt')
  assert.equal(kind('error'), 'interrupt')
  assert.equal(kind('max-tokens'), 'interrupt')
  assert.equal(kind('aborted'), null, '自己取消不提示')
  assert.equal(kind('whatever'), null)
})

test('classifyEvent 对残缺事件是安全的', () => {
  assert.equal(classifyEvent(null), null)
  assert.equal(classifyEvent(undefined), null)
  assert.equal(classifyEvent('turn/end'), null)
  assert.equal(classifyEvent({ type: 'turn/end' }), null)
  assert.equal(classifyEvent({ type: 'session/start', data: {} }), null)
})
