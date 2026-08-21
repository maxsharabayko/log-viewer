import type { LogEntry, LogFiltersState, SortDirection, SortKey } from '../types/log.ts'

export function createDefaultFilters(): LogFiltersState {
  return {
    searchText: '',
    levels: new Set(['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal', 'Unknown']),
    area: 'all',
    component: 'all',
    includeStructured: true,
    includeExternal: true,
    includeUnstructured: true,
  }
}

export function filterEntries(entries: LogEntry[], filters: LogFiltersState): LogEntry[] {
  const needle = filters.searchText.trim().toLowerCase()

  return entries.filter((entry) => {
    if (!filters.levels.has(entry.level)) {
      return false
    }

    if (entry.kind === 'structured' && !filters.includeStructured) {
      return false
    }

    if (entry.kind === 'external' && !filters.includeExternal) {
      return false
    }

    if (entry.kind === 'unstructured' && !filters.includeUnstructured) {
      return false
    }

    if (filters.area !== 'all' && entry.area !== filters.area) {
      return false
    }

    if (filters.component !== 'all' && entry.component !== filters.component) {
      return false
    }

    if (needle === '') {
      return true
    }

    const haystack = [entry.raw, entry.message, entry.area, entry.component, entry.context, entry.level]
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function sortEntries(entries: LogEntry[], sortKey: SortKey, direction: SortDirection): LogEntry[] {
  const factor = direction === 'asc' ? 1 : -1

  return [...entries].sort((left, right) => {
    if (sortKey === 'timestamp') {
      const leftValue = left.timestampSort ?? Number.MAX_SAFE_INTEGER
      const rightValue = right.timestampSort ?? Number.MAX_SAFE_INTEGER

      if (leftValue !== rightValue) {
        return (leftValue - rightValue) * factor
      }

      return (left.lineNumber - right.lineNumber) * factor
    }

    if (sortKey === 'lineNumber') {
      return (left.lineNumber - right.lineNumber) * factor
    }

    if (sortKey === 'level') {
      if (left.levelRank !== right.levelRank) {
        return (left.levelRank - right.levelRank) * factor
      }

      return (left.lineNumber - right.lineNumber) * factor
    }

    const leftValue = left[sortKey].toLowerCase()
    const rightValue = right[sortKey].toLowerCase()
    const comparison = leftValue.localeCompare(rightValue)

    if (comparison !== 0) {
      return comparison * factor
    }

    return (left.lineNumber - right.lineNumber) * factor
  })
}