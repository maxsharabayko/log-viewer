# NGX Log Viewer

Static client-side log viewer for proprietary application logs. The app runs entirely in the browser, supports local file upload, and keeps non-matching runtime lines visible instead of discarding them.

## Current Features

- Upload or drag and drop a `.log` or `.txt` file.
- Parse the current primary format: `YYYY-MM-DD HH:MM:SS.ffffff Level : message`.
- Extract timestamp, severity, area, component, message, and raw line.
- Preserve external or fallback lines such as GLib or GStreamer runtime output.
- Filter by free-text search, severity, area, component, and parsed kind.
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

## Deployment

The GitHub Pages workflow deploys every push to `main` and can also be run manually from the Actions tab. Enable **GitHub Actions** as the repository's Pages source in **Settings > Pages**. The deployed site is served from `https://maxsharabayko.github.io/log-viewer/`.

## Parsing Rules

The parser handles three kinds of rows:

1. `structured`: Your main application format with full date, time, and level.
2. `external`: Foreign runtime or library output such as GLib critical lines or other `Prefix: message` rows.
3. `unstructured`: Anything else that does not match the current heuristics.

Area and component extraction follow these rules:

- `[ngx-decoder::sink] ...` becomes area `ngx-decoder`, component `sink`.
- `IPC: Getting decoder...` becomes area `IPC`.
- `IPC: [Configure Decoder] decoder ID 1.` becomes area `IPC`, component `Configure Decoder`.

## Recommended Logging Format

For future consistency, prefer a delimiter-based format instead of relying on visual alignment:

```text
YYYY-MM-DD HH:MM:SS.ffffff Level : [AREA] (component) message
```

Example:

```text
2026-03-11 09:04:25.782170 Info  : [PIPELINE_1] (haisrtsrc) SRTSocket::Connect() - Link : srt://10.129.10.35:4201
```

Recommended field meanings:

- `AREA`: subsystem or ownership boundary such as `PIPELINE_1`, `IPC`, or `DECODER`.
- `component`: concrete module, class, element, or instance such as `haisrtsrc` or `ngx-decoder::sink`.
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