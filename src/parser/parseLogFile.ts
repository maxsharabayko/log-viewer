import { parseLogLine } from './parseLogLine.ts'
import type { LogEntry } from '../types/log.ts'

export function parseLogText(content: string): LogEntry[] {
  return content
    .split(/\r?\n/)
    .filter((line, index, lines) => line.trim() !== '' || index < lines.length - 1)
    .map((line, index) => parseLogLine(line, index + 1))
}