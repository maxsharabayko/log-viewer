import './style.css'
import { createDefaultFilters, filterEntries, sortEntries } from './filters/logFilters.ts'
import { parseLogText } from './parser/parseLogFile.ts'
import { ALL_LEVELS, type EntryKind, type LogEntry, type LogFiltersState, type SortDirection, type SortKey } from './types/log.ts'

type AppState = {
  entries: LogEntry[]
  filteredEntries: LogEntry[]
  filters: LogFiltersState
  expandedIds: Set<number>
  markedIds: Set<number>
  activeMarkId: number | null
  showMarkedOnly: boolean
  selectedName: string
  sortKey: SortKey
  sortDirection: SortDirection
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Application root not found.')
}

const initialFilters = createDefaultFilters()

const state: AppState = {
  entries: [],
  filteredEntries: [],
  filters: initialFilters,
  expandedIds: new Set<number>(),
  markedIds: new Set<number>(),
  activeMarkId: null,
  showMarkedOnly: false,
  selectedName: 'No file loaded',
  sortKey: 'timestamp',
  sortDirection: 'asc',
}

app.innerHTML = `
  <div class="shell">
    <header class="hero-panel">
      <div>
        <p class="eyebrow">Offline Static Viewer</p>
        <h1>ngx log viewer</h1>
        <p class="hero-copy">Compact log inspection for dense, editor-like browsing.</p>
      </div>
      <div class="format-card">
        <p class="format-label">Target format</p>
        <code>YYYY-MM-DD HH:MM:SS.ffffff Level : [AREA] (component) message</code>
        <p class="format-note">Current logs still work; fallback rows preserve GLib and GStreamer output.</p>
      </div>
    </header>

    <section class="upload-panel">
      <label class="dropzone" for="log-file">
        <input id="log-file" type="file" accept=".log,.txt,text/plain" />
        <span class="dropzone-title">Upload log file</span>
        <span class="dropzone-subtitle">Drag and drop a local log or browse from disk.</span>
      </label>
    </section>

    <section class="summary-grid" id="summary-grid"></section>

    <section class="content-grid">
      <div class="table-panel">
        <div class="table-filters">
          <div class="toolbar-grid">
            <label class="field">
              <span>Search</span>
              <input id="search-text" type="search" placeholder="Search message, area, component, raw line" />
            </label>

            <label class="field">
              <span>Area</span>
              <select id="area-filter">
                <option value="all">All areas</option>
              </select>
            </label>

            <label class="field">
              <span>Component</span>
              <select id="component-filter">
                <option value="all">All components</option>
              </select>
            </label>
          </div>

          <div class="level-toolbar">
            <span class="field-label">Log levels</span>
          </div>

          <div class="levels-cluster">
            <div class="level-row" id="level-row"></div>
            <div class="level-actions level-actions-inline" aria-label="Log level actions">
              <button id="reset-levels" class="level-action-btn" type="button">Reset all</button>
              <button id="select-all-levels" class="level-action-btn" type="button">Select all</button>
            </div>
          </div>

          <div class="kind-row">
            <label><input id="structured-toggle" type="checkbox" checked /> Structured</label>
            <label><input id="external-toggle" type="checkbox" checked /> External</label>
            <label><input id="unstructured-toggle" type="checkbox" checked /> Unstructured</label>
          </div>

          <div class="mark-toolbar">
            <label><input id="marked-only-toggle" type="checkbox" /> Marked only</label>
            <span id="mark-count" class="mark-count">0 marked</span>
            <div class="mark-nav">
              <button id="mark-prev" class="level-action-btn" type="button" title="Previous marked line">↑ Prev</button>
              <button id="mark-next" class="level-action-btn" type="button" title="Next marked line">↓ Next</button>
            </div>
          </div>
        </div>

        <div class="panel-header">
          <div>
            <h2>Events</h2>
            <p id="results-meta">Load a file to inspect entries.</p>
          </div>
          <label class="field inline-field">
            <span>Sort</span>
            <select id="sort-select">
              <option value="timestamp:asc">Timestamp ↑</option>
              <option value="timestamp:desc">Timestamp ↓</option>
              <option value="lineNumber:asc">Line ↑</option>
              <option value="lineNumber:desc">Line ↓</option>
              <option value="level:desc">Severity ↓</option>
              <option value="area:asc">Area A-Z</option>
              <option value="component:asc">Component A-Z</option>
            </select>
          </label>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="mark-col"></th>
                <th>Line</th>
                <th>Timestamp</th>
                <th>Level</th>
                <th>Area</th>
                <th>Component</th>
                <th>Message</th>
                <th>Kind</th>
              </tr>
            </thead>
            <tbody id="results-body"></tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
`

const fileInput = document.querySelector<HTMLInputElement>('#log-file')
const searchInput = document.querySelector<HTMLInputElement>('#search-text')
const areaSelect = document.querySelector<HTMLSelectElement>('#area-filter')
const componentSelect = document.querySelector<HTMLSelectElement>('#component-filter')
const structuredToggle = document.querySelector<HTMLInputElement>('#structured-toggle')
const externalToggle = document.querySelector<HTMLInputElement>('#external-toggle')
const unstructuredToggle = document.querySelector<HTMLInputElement>('#unstructured-toggle')
const sortSelect = document.querySelector<HTMLSelectElement>('#sort-select')
const levelRow = document.querySelector<HTMLDivElement>('#level-row')
const resetLevelsButton = document.querySelector<HTMLButtonElement>('#reset-levels')
const selectAllLevelsButton = document.querySelector<HTMLButtonElement>('#select-all-levels')
const markedOnlyToggle = document.querySelector<HTMLInputElement>('#marked-only-toggle')
const markCountLabel = document.querySelector<HTMLSpanElement>('#mark-count')
const markPrevButton = document.querySelector<HTMLButtonElement>('#mark-prev')
const markNextButton = document.querySelector<HTMLButtonElement>('#mark-next')
const summaryGrid = document.querySelector<HTMLDivElement>('#summary-grid')
const resultsBody = document.querySelector<HTMLTableSectionElement>('#results-body')
const resultsMeta = document.querySelector<HTMLParagraphElement>('#results-meta')
const dropzone = document.querySelector<HTMLLabelElement>('.dropzone')

if (
  !fileInput ||
  !searchInput ||
  !areaSelect ||
  !componentSelect ||
  !structuredToggle ||
  !externalToggle ||
  !unstructuredToggle ||
  !sortSelect ||
  !levelRow ||
  !resetLevelsButton ||
  !selectAllLevelsButton ||
  !markedOnlyToggle ||
  !markCountLabel ||
  !markPrevButton ||
  !markNextButton ||
  !summaryGrid ||
  !resultsBody ||
  !resultsMeta ||
  !dropzone
) {
  throw new Error('Application UI failed to initialize.')
}

const ui = {
  fileInput,
  searchInput,
  areaSelect,
  componentSelect,
  structuredToggle,
  externalToggle,
  unstructuredToggle,
  sortSelect,
  levelRow,
  resetLevelsButton,
  selectAllLevelsButton,
  markedOnlyToggle,
  markCountLabel,
  markPrevButton,
  markNextButton,
  summaryGrid,
  resultsBody,
  resultsMeta,
  dropzone,
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function badgeClass(kind: EntryKind): string {
  if (kind === 'structured') {
    return 'kind-structured'
  }

  if (kind === 'external') {
    return 'kind-external'
  }

  return 'kind-unstructured'
}

function updateFilterOptions(): void {
  const allAreas = Array.from(new Set(state.entries.map((entry) => entry.area).filter((value) => value !== 'General'))).sort((left, right) => left.localeCompare(right))
  const allComponents = Array.from(new Set(state.entries.map((entry) => entry.component).filter((value) => value !== 'n/a'))).sort((left, right) => left.localeCompare(right))

  ui.areaSelect.innerHTML = ['<option value="all">All areas</option>', ...allAreas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`)].join('')
  ui.componentSelect.innerHTML = ['<option value="all">All components</option>', ...allComponents.map((component) => `<option value="${escapeHtml(component)}">${escapeHtml(component)}</option>`)].join('')

  ui.areaSelect.value = state.filters.area
  ui.componentSelect.value = state.filters.component
}

function renderLevelFilters(): void {
  ui.levelRow.innerHTML = ALL_LEVELS.map((level) => {
    const checked = state.filters.levels.has(level) ? 'checked' : ''
    return `
      <label class="level-pill level-${level.toLowerCase()}">
        <input type="checkbox" value="${level}" ${checked} />
        <span>${level}</span>
      </label>
    `
  }).join('')

  for (const checkbox of ui.levelRow.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.filters.levels.add(checkbox.value as LogEntry['level'])
      } else {
        state.filters.levels.delete(checkbox.value as LogEntry['level'])
      }

      applyState()
    })
  }
}

function renderSummary(): void {
  if (state.entries.length === 0) {
    ui.summaryGrid.innerHTML = `
      <article class="summary-card">
        <h3>No data loaded</h3>
        <p>Upload a log file to see parse coverage, dominant areas, and severity counts.</p>
      </article>
    `
    return
  }

  const structuredCount = state.entries.filter((entry) => entry.kind === 'structured').length
  const externalCount = state.entries.filter((entry) => entry.kind === 'external').length
  const unstructuredCount = state.entries.filter((entry) => entry.kind === 'unstructured').length
  const topArea = [...state.entries.reduce((map, entry) => map.set(entry.area, (map.get(entry.area) ?? 0) + 1), new Map<string, number>())]
    .sort((left, right) => right[1] - left[1])[0]
  const warnCount = state.entries.filter((entry) => entry.level === 'Warn' || entry.level === 'Error' || entry.level === 'Fatal').length

  ui.summaryGrid.innerHTML = `
    <article class="summary-card">
      <p class="summary-label">Loaded file</p>
      <h3>${escapeHtml(state.selectedName)}</h3>
      <p>${state.entries.length} rows indexed in browser memory.</p>
    </article>
    <article class="summary-card">
      <p class="summary-label">Parse coverage</p>
      <h3>${structuredCount} structured</h3>
      <p>${externalCount} external, ${unstructuredCount} unstructured.</p>
    </article>
    <article class="summary-card">
      <p class="summary-label">Noise watch</p>
      <h3>${warnCount} warn+</h3>
      <p>${topArea ? `Most active area: ${escapeHtml(topArea[0])}` : 'No dominant area yet.'}</p>
    </article>
  `
}

function getMarkableEntries(): LogEntry[] {
  return state.showMarkedOnly ? state.filteredEntries.filter((entry) => state.markedIds.has(entry.id)) : state.filteredEntries
}

function renderTable(): void {
  const rows = getMarkableEntries()

  if (rows.length === 0) {
    ui.resultsBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">No rows match the current filters.</td>
      </tr>
    `
    return
  }

  ui.resultsBody.innerHTML = rows.map((entry) => {
    const isExpanded = state.expandedIds.has(entry.id)
    const isMarked = state.markedIds.has(entry.id)
    const messagePreview = entry.message.length > 120 ? `${entry.message.slice(0, 117)}...` : entry.message
    const displayedMessage = isExpanded ? entry.message : messagePreview
    const rowClasses = [isExpanded ? 'expanded' : '', isMarked ? 'marked' : '', entry.id === state.activeMarkId ? 'mark-focus' : ''].filter(Boolean).join(' ')

    return `
      <tr data-entry-id="${entry.id}" class="${rowClasses}">
        <td class="mark-cell">
          <button type="button" class="mark-btn ${isMarked ? 'marked' : ''}" data-mark-id="${entry.id}" title="${isMarked ? 'Unmark line' : 'Mark line'}">${isMarked ? '★' : '☆'}</button>
        </td>
        <td>${entry.lineNumber}</td>
        <td>${escapeHtml(entry.timestampText ?? 'n/a')}</td>
        <td><span class="severity severity-${entry.level.toLowerCase()}">${entry.level}</span></td>
        <td>${escapeHtml(entry.area)}</td>
        <td>${escapeHtml(entry.component)}</td>
        <td class="message-cell ${isExpanded ? 'message-expanded' : ''}">${escapeHtml(displayedMessage)}</td>
        <td><span class="kind-badge ${badgeClass(entry.kind)}">${entry.kind}</span></td>
      </tr>
      ${isExpanded ? `
      <tr class="expand-row" data-parent-entry-id="${entry.id}">
        <td colspan="8">
          <div class="expand-grid">
            <p><strong>Context:</strong> ${escapeHtml(entry.context || 'n/a')}</p>
            <p><strong>Raw:</strong> ${escapeHtml(entry.raw)}</p>
          </div>
        </td>
      </tr>
      ` : ''}
    `
  }).join('')

  for (const button of ui.resultsBody.querySelectorAll<HTMLButtonElement>('.mark-btn')) {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const id = Number(button.dataset.markId)
      toggleMark(id)
    })
  }

  for (const row of ui.resultsBody.querySelectorAll<HTMLTableRowElement>('tr[data-entry-id]')) {
    row.addEventListener('click', () => {
      const id = Number(row.dataset.entryId)
      if (state.expandedIds.has(id)) {
        state.expandedIds.delete(id)
      } else {
        state.expandedIds.add(id)
      }
      renderTable()
    })
  }
}

function toggleMark(id: number): void {
  if (state.markedIds.has(id)) {
    state.markedIds.delete(id)
  } else {
    state.markedIds.add(id)
  }
  renderMarkCount()
  renderTable()
}

function renderMarkCount(): void {
  ui.markCountLabel.textContent = `${state.markedIds.size} marked`
}

function navigateMark(direction: 1 | -1): void {
  const marked = state.filteredEntries.filter((entry) => state.markedIds.has(entry.id))

  if (marked.length === 0) {
    return
  }

  const currentIndex = marked.findIndex((entry) => entry.id === state.activeMarkId)
  const nextIndex = currentIndex === -1
    ? (direction === 1 ? 0 : marked.length - 1)
    : (currentIndex + direction + marked.length) % marked.length

  state.activeMarkId = marked[nextIndex].id
  renderTable()

  const targetRow = ui.resultsBody.querySelector<HTMLTableRowElement>(`tr[data-entry-id="${state.activeMarkId}"]`)
  targetRow?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function applyState(): void {
  const filtered = filterEntries(state.entries, state.filters)
  state.filteredEntries = sortEntries(filtered, state.sortKey, state.sortDirection)

  const visibleIds = new Set(state.filteredEntries.map((entry) => entry.id))
  for (const id of state.expandedIds) {
    if (!visibleIds.has(id)) {
      state.expandedIds.delete(id)
    }
  }

  for (const id of Array.from(state.markedIds)) {
    if (!state.entries.some((entry) => entry.id === id)) {
      state.markedIds.delete(id)
    }
  }

  if (state.activeMarkId !== null && !state.markedIds.has(state.activeMarkId)) {
    state.activeMarkId = null
  }

  ui.resultsMeta.textContent = `${state.filteredEntries.length} of ${state.entries.length} rows visible`
  renderSummary()
  renderMarkCount()
  renderTable()
}

async function loadFile(file: File): Promise<void> {
  state.selectedName = file.name
  const content = await file.text()
  state.entries = parseLogText(content)
  updateFilterOptions()
  applyState()
}

ui.fileInput.addEventListener('change', async () => {
  const file = ui.fileInput.files?.[0]

  if (!file) {
    return
  }

  await loadFile(file)
})

ui.searchInput.addEventListener('input', () => {
  state.filters.searchText = ui.searchInput.value
  applyState()
})

ui.areaSelect.addEventListener('change', () => {
  state.filters.area = ui.areaSelect.value
  applyState()
})

ui.componentSelect.addEventListener('change', () => {
  state.filters.component = ui.componentSelect.value
  applyState()
})

ui.structuredToggle.addEventListener('change', () => {
  state.filters.includeStructured = ui.structuredToggle.checked
  applyState()
})

ui.externalToggle.addEventListener('change', () => {
  state.filters.includeExternal = ui.externalToggle.checked
  applyState()
})

ui.unstructuredToggle.addEventListener('change', () => {
  state.filters.includeUnstructured = ui.unstructuredToggle.checked
  applyState()
})

ui.sortSelect.addEventListener('change', () => {
  const [key, direction] = ui.sortSelect.value.split(':') as [SortKey, SortDirection]
  state.sortKey = key
  state.sortDirection = direction
  applyState()
})

ui.resetLevelsButton.addEventListener('click', () => {
  state.filters.levels.clear()
  renderLevelFilters()
  applyState()
})

ui.selectAllLevelsButton.addEventListener('click', () => {
  state.filters.levels = new Set(ALL_LEVELS)
  renderLevelFilters()
  applyState()
})

ui.markedOnlyToggle.addEventListener('change', () => {
  state.showMarkedOnly = ui.markedOnlyToggle.checked
  renderTable()
})

ui.markPrevButton.addEventListener('click', () => {
  navigateMark(-1)
})

ui.markNextButton.addEventListener('click', () => {
  navigateMark(1)
})

ui.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault()
  ui.dropzone.classList.add('drag-active')
})

ui.dropzone.addEventListener('dragleave', () => {
  ui.dropzone.classList.remove('drag-active')
})

ui.dropzone.addEventListener('drop', async (event) => {
  event.preventDefault()
  ui.dropzone.classList.remove('drag-active')
  const file = event.dataTransfer?.files?.[0]

  if (!file) {
    return
  }

  await loadFile(file)
})

renderLevelFilters()
applyState()
