import { parseLogLine } from './parseLogLine.ts'
import type { LogEntry } from '../types/log.ts'

export async function parseLogFile(file: Blob): Promise<LogEntry[]> {
  const entries: LogEntry[] = []
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader()
  let pending = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = pending + value
      let start = 0
      let end: number
      while ((end = text.indexOf('\n', start)) !== -1) {
        const line = text.slice(start, end).replace(/\r$/, '')
        entries.push(parseLogLine(line, entries.length + 1))
        start = end + 1
      }
      pending = text.slice(start)
    }

    if (pending.trim() !== '') {
      entries.push(parseLogLine(pending, entries.length + 1))
    }
    return entries
  } finally {
    reader.releaseLock()
  }
}

export function parseLogText(content: string): LogEntry[] {
  return content
    .split(/\r?\n/)
    .filter((line, index, lines) => line.trim() !== '' || index < lines.length - 1)
    .map((line, index) => parseLogLine(line, index + 1))
}