# Copilot Instructions

This project is a static log viewer for proprietary application logs.

Primary project goal:
- Maximize useful on-screen log density so the viewer remains competitive with a regular text editor for scanning many lines at once.

Implementation priorities:
- Favor compact layouts, small controls, and efficient vertical space usage.
- The table of log lines is the product's main surface and should dominate the viewport.
- Avoid large hero sections, oversized cards, or decorative spacing that reduces visible log rows.
- Preserve fast client-side filtering and search for uploaded local files.
- Keep parsing fully local in the browser; do not introduce network dependencies for log content.

Parsing expectations:
- Support the current log format: `YYYY-MM-DD HH:MM:SS.ffffff Level : message`.
- Extract and display timestamp, severity, area, component, message, and raw line where possible.
- Preserve foreign or malformed lines as visible fallback rows instead of dropping them.

Logging consistency guidance:
- Prefer a delimiter-based canonical format: `YYYY-MM-DD HH:MM:SS.ffffff Level : [AREA] (component) message`.
- Use `AREA` for subsystem ownership and `component` for the concrete module, class, or pipeline element.
- Standardize severity vocabulary to `Trace`, `Debug`, `Info`, `Warn`, `Error`, `Fatal`.

Change guidelines:
- When editing UI, bias toward density, readability, and scan speed over marketing-style presentation.
- Keep the site deployable as a static build.