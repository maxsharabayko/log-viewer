# NGX Log Viewer

Static client-side log viewer for proprietary application logs. The app runs entirely in the browser, supports local file upload, and keeps non-matching runtime lines visible instead of discarding them.

## Current Features

- Upload or drag and drop a `.log` or `.txt` file.
- Parse the primary format: `YYYY-MM-DD HH:MM:SS.ffffff Level : [area:component:subcomponent] message`.
- Extract timestamp, severity, area, component, message, and raw line.
- Preserve external or fallback lines such as GLib or GStreamer runtime output.
- Filter by free-text search, severity, area, component, and parsed kind. Press Enter to apply search text; clearing the search applies immediately. Typing does not scan the log on every keystroke.
- Browse 500 rows per page, with direct page selection. Filtering and sorting cover the entire log, and marked-line navigation switches pages automatically.
- Read uploaded files incrementally and render only the current page, avoiding oversized HTML strings for large logs. Parsed entries still reside in browser memory, so available memory limits the maximum file size.
- Inspect the selected row in a detail panel.

## Development

If Node is not on `PATH`, enable it in PowerShell with `fnm` first:

```powershell
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm use --install-if-missing lts-latest
```

Start the dev server:

```powershell
npm run dev
```

Build the static site:

```powershell
npm run build
```

Run parser and pagination regression tests (Node.js 22.18+):

```powershell
npm test
```

## Deployment

The GitHub Pages workflow deploys every push to `main` and can also be run manually from the Actions tab. Enable **GitHub Actions** as the repository's Pages source in **Settings > Pages**. The deployed site is served from `https://maxsharabayko.github.io/log-viewer/`.

## Parsing Rules

The parser handles three kinds of rows:

1. `structured`: Your main application format with full date, time, and level.
2. `external`: Foreign runtime or library output such as GLib critical lines or other `Prefix: message` rows.
3. `unstructured`: Anything else that does not match the current heuristics.

Area and component extraction follow these rules:

- `[area:component:subcomponent] ...` becomes area `area`, component `component:subcomponent`. Any number of nested modules is supported; the remaining text is preserved as the message without further prefix extraction.
- `[ngx-decoder::sink] ...` becomes area `ngx-decoder`, component `sink`.
- `IPC: Getting decoder...` becomes area `IPC`.
- `IPC: [Configure Decoder] decoder ID 1.` becomes area `IPC`, component `Configure Decoder`.

## Canonical Logging Format

The final format puts the area and module hierarchy together in square brackets:

```text
YYYY-MM-DD HH:MM:SS.ffffff Level : [area:component:subcomponent] message
```

Example:

```text
2026-09-02 16:18:42.478127 Trace : [area:component:subcomponent] Processing request...
```

Field meanings:

- `area`: subsystem or ownership boundary such as `PIPELINE_1`, `IPC`, or `DECODER`.
- `component`, `subcomponent`, and further colon-separated segments: module hierarchy, displayed and filtered together in the Component column.
- `message`: free-text event description.

Recommended severity vocabulary:

- `Trace`
- `Debug`
- `Info`
- `Warn`
- `Error`
- `Fatal`

## Notes

- The first version does not persist logs or send them over the network.
- Parsing stays intentionally heuristic. Unknown lines remain visible rather than being dropped.