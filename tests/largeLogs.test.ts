import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLogFile, parseLogText } from '../src/parser/parseLogFile.ts'
import { getPage, PAGE_SIZE } from '../src/tablePagination.ts'
import { createDefaultFilters, filterEntries, sortEntries } from '../src/filters/logFilters.ts'

test('streaming preserves text parser behavior, including fallback and blank lines', async () => {
  for (const text of ['', '\n', ' \n \n ', 'foreign\r\n\r\nlast', 'first\nlast\r', 'é😀\n尾',
    '2026-03-11 09:04:25.782170 Info : [IPC] message\r\nfallback\n']) {
    assert.deepEqual(await parseLogFile(new Blob([text])), parseLogText(text))
  }
})

test('streaming handles UTF-8 characters and CRLF split across chunks', async () => {
  const text = '2026-03-11 09:04:25.782170 Info : [IPC] café😀\r\n\nforeign\r\nlast'
  const bytes = new TextEncoder().encode(text)
  const file = new Blob()
  file.stream = () => new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      controller.close()
    },
  })
  assert.deepEqual(await parseLogFile(file), parseLogText(text))
})

test('read failures are propagated rather than returning a partial log', async () => {
  const file = new Blob()
  file.stream = () => new ReadableStream({
    start(controller) {
      controller.error(new Error('Read failed'))
    },
  })
  await assert.rejects(parseLogFile(file), /Read failed/)
})

test('pages bound rendering without losing rows or exposing invalid pages', () => {
  assert.deepEqual(getPage(0, 10), { page: 0, pageCount: 1, start: 0, end: 0 })
  assert.deepEqual(getPage(501, -1), { page: 0, pageCount: 2, start: 0, end: 500 })
  assert.deepEqual(getPage(501, 99), { page: 1, pageCount: 2, start: 500, end: 501 })
  assert.equal(getPage(1000, 1).pageCount, 2)
  const total = 2_000_001
  let visited = 0
  const pageCount = getPage(total, 0).pageCount
  for (let page = 0; page < pageCount; page++) {
    const { start, end } = getPage(total, page)
    assert.equal(start, visited)
    assert.ok(end - start <= PAGE_SIZE)
    visited = end
  }
  assert.equal(visited, total)
})

test('large logs retain full-log filtering and sorting before paging', async () => {
  const count = 20_001
  const text = Array.from({ length: count }, (_, index) =>
    `2026-03-11 09:04:25.782170 Info : [IPC] message ${index}`,
  ).join('\n')
  const entries = await parseLogFile(new Blob([text]))
  assert.equal(entries.length, count)
  const filters = createDefaultFilters()
  filters.searchText = 'message 20000'
  assert.equal(filterEntries(entries, filters)[0].lineNumber, count)
  const sorted = sortEntries(entries, 'lineNumber', 'desc')
  const { start, end } = getPage(sorted.length, 0)
  assert.equal(sorted.slice(start, end).length, PAGE_SIZE)
  assert.equal(sorted[start].lineNumber, count)
})
