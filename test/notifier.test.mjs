import test from 'node:test'
import assert from 'node:assert/strict'

import { Config, apply, createNotifier } from '../index.js'

/** 假时钟 + 假 showToast，返回记录。 */
function harness(options = {}, startAt = 1_000_000) {
  let clock = startAt
  const shown = []
  const notify = createNotifier(Config(options), {
    now: () => clock,
    show: (text, extra) => {
      shown.push({ text, ...extra })
      return true
    },
  })
  return { notify, shown, advance: (ms) => { clock += ms } }
}

test('中断与完成各自成文', () => {
  const { notify, shown } = harness({ bootQuietMs: 0 })
  notify('interrupt')
  notify('done')
  assert.deepEqual(shown.map((row) => row.text), ['任务中断 · 需要你处理', '任务完成'])
})

test('同类弹窗在 dedupeWindowMs 内只弹一次，两类互不影响', () => {
  const { notify, shown, advance } = harness({ bootQuietMs: 0, dedupeWindowMs: 3000 })
  notify('interrupt')
  advance(1000)
  notify('interrupt')
  notify('done') // 不同类，不受去重影响
  advance(2500)
  notify('interrupt') // 距第一次 3500ms，允许
  assert.equal(shown.length, 3)
  assert.deepEqual(shown.map((row) => row.text), ['任务中断 · 需要你处理', '任务完成', '任务中断 · 需要你处理'])
})

test('刚加载的静默期只吞掉「完成」，不吞「中断」', () => {
  const { notify, shown, advance } = harness({ bootQuietMs: 3000 })
  notify('done') // t=0，静默期内
  notify('interrupt')
  advance(3000)
  notify('done')
  assert.deepEqual(shown.map((row) => row.text), ['任务中断 · 需要你处理', '任务完成'])
})

test('开关能关掉对应的提示', () => {
  const { notify, shown } = harness({ onInterrupt: false, bootQuietMs: 0 })
  notify('interrupt')
  notify('done')
  assert.deepEqual(shown.map((row) => row.text), ['任务完成'])

  const onlyInterrupt = harness({ onDone: false, bootQuietMs: 0 })
  onlyInterrupt.notify('interrupt')
  onlyInterrupt.notify('done')
  assert.deepEqual(onlyInterrupt.shown.map((row) => row.text), ['任务中断 · 需要你处理'])
})

test('静音与 appId 透传给弹窗', () => {
  const { notify, shown } = harness({ bootQuietMs: 0, silent: true, appId: 'com.example.app' })
  notify('done')
  assert.deepEqual(shown, [{ text: '任务完成', silent: true, appId: 'com.example.app' }])
})

test('自定义文案', () => {
  const { notify, shown } = harness({ bootQuietMs: 0, doneText: '收工', interruptText: '等你' })
  notify('done')
  notify('interrupt')
  assert.deepEqual(shown.map((row) => row.text), ['收工', '等你'])
})

test('未知类别不弹', () => {
  const { notify, shown } = harness({ bootQuietMs: 0 })
  notify('other')
  assert.equal(shown.length, 0)
})

test('apply 注册一个全局的 session/event 监听器', () => {
  const registered = []
  const ctx = {
    on(event, listener, options) {
      registered.push({ event, listener, options })
      return () => {}
    },
  }
  apply(ctx, {})
  assert.equal(registered.length, 1)
  assert.equal(registered[0].event, 'session/event')
  assert.deepEqual(registered[0].options, { global: true })
  assert.equal(typeof registered[0].listener, 'function')
})
