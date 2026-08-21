import type { LogEntry, LogLevel } from '../types/log.ts'

const LEVEL_RANK: Record<LogLevel, number> = {
  Trace: 10,
  Debug: 20,
  Info: 30,
  Warn: 40,
  Error: 50,
  Fatal: 60,
  Unknown: 0,
}

const structuredPattern = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}\.\d{1,6}) (Trace|Debug|Info|Warn|Error|Fatal)\s*:\s*(.*)$/
const glibPattern = /^\(([^:]+):(\d+)\):\s+([A-Z0-9-]+)\s+\*\*:\s+(\d{2}:\d{2}:\d{2}\.\d+):\s+(.*)$/
const prefixPattern = /^([A-Za-z][A-Za-z0-9 _-]{1,40}):(?!:)(?:\s+)?(.*)$/
const bracketPattern = /^\[([^\]]+)\]\s*(.*)$/

function toTimestampSort(dateText: string, timeText: string): number {
  const [clock, fraction = '0'] = timeText.split('.')
  const milliseconds = fraction.slice(0, 3).padEnd(3, '0')
  const microseconds = fraction.padEnd(6, '0').slice(3, 6)
  const epochMilliseconds = Date.parse(`${dateText}T${clock}.${milliseconds}Z`)
  return epochMilliseconds * 1000 + Number(microseconds)
}

function splitContext(context: string): { area: string; component: string } {
  const segments = context.split('::').map((segment) => segment.trim()).filter(Boolean)

  if (segments.length === 0) {
    return { area: 'General', component: 'n/a' }
  }

  if (segments.length === 1) {
    return { area: segments[0], component: segments[0] }
  }

  return {
    area: segments[0],
    component: segments.slice(1).join('::'),
  }
}

function extractMessageParts(message: string): { area: string; component: string; context: string; message: string } {
  let rest = message.trim()
  let area = 'General'
  let component = 'n/a'
  const contexts: string[] = []

  const leadingBracket = bracketPattern.exec(rest)
  if (leadingBracket) {
    contexts.push(leadingBracket[1].trim())
    rest = leadingBracket[2].trim()
    const split = splitContext(leadingBracket[1].trim())
    area = split.area
    component = split.component
  }

  const prefixed = prefixPattern.exec(rest)
  if (prefixed) {
    area = prefixed[1].trim()
    rest = prefixed[2].trim()
  }

  const secondaryBracket = bracketPattern.exec(rest)
  if (secondaryBracket) {
    contexts.push(secondaryBracket[1].trim())
    rest = secondaryBracket[2].trim()
    if (component === 'n/a') {
      component = secondaryBracket[1].trim()
    }
    if (area === 'General') {
      const split = splitContext(secondaryBracket[1].trim())
      area = split.area
    }
  }

  return {
    area,
    component,
    context: contexts.join(' | '),
    message: rest || message.trim(),
  }
}

function createEntry(entry: Omit<LogEntry, 'levelRank'>): LogEntry {
  return {
    ...entry,
    levelRank: LEVEL_RANK[entry.level],
  }
}

export function parseLogLine(line: string, lineNumber: number): LogEntry {
  const structuredMatch = structuredPattern.exec(line)

  if (structuredMatch) {
    const [, dateText, timeText, rawLevel, rawMessage] = structuredMatch
    const level = rawLevel as LogLevel
    const parsed = extractMessageParts(rawMessage)
    return createEntry({
      id: lineNumber,
      lineNumber,
      raw: line,
      kind: 'structured',
      level,
      timestampText: `${dateText} ${timeText}`,
      timestampSort: toTimestampSort(dateText, timeText),
      area: parsed.area,
      component: parsed.component,
      context: parsed.context,
      message: parsed.message,
    })
  }

  const glibMatch = glibPattern.exec(line)
  if (glibMatch) {
    const [, processName, processId, category, timeText, message] = glibMatch
    return createEntry({
      id: lineNumber,
      lineNumber,
      raw: line,
      kind: 'external',
      level: 'Error',
      timestampText: timeText,
      timestampSort: null,
      area: category,
      component: `${processName}:${processId}`,
      context: category,
      message,
    })
  }

  const prefixMatch = prefixPattern.exec(line.trim())
  if (prefixMatch) {
    return createEntry({
      id: lineNumber,
      lineNumber,
      raw: line,
      kind: 'external',
      level: 'Unknown',
      timestampText: null,
      timestampSort: null,
      area: prefixMatch[1].trim(),
      component: 'n/a',
      context: prefixMatch[1].trim(),
      message: prefixMatch[2].trim() || line.trim(),
    })
  }

  return createEntry({
    id: lineNumber,
    lineNumber,
    raw: line,
    kind: 'unstructured',
    level: 'Unknown',
    timestampText: null,
    timestampSort: null,
    area: 'Unstructured',
    component: 'n/a',
    context: '',
    message: line.trim() || '(blank line)',
  })
}