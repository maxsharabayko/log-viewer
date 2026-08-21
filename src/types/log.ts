export const ALL_LEVELS = ['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal', 'Unknown'] as const

export type LogLevel = (typeof ALL_LEVELS)[number]
export type EntryKind = 'structured' | 'external' | 'unstructured'
export type SortKey = 'timestamp' | 'lineNumber' | 'level' | 'area' | 'component'
export type SortDirection = 'asc' | 'desc'

export type LogEntry = {
  id: number
  lineNumber: number
  raw: string
  kind: EntryKind
  level: LogLevel
  levelRank: number
  timestampText: string | null
  timestampSort: number | null
  area: string
  component: string
  context: string
  message: string
}

export type LogFiltersState = {
  searchText: string
  levels: Set<LogLevel>
  area: string
  component: string
  includeStructured: boolean
  includeExternal: boolean
  includeUnstructured: boolean
}