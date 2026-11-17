# River

A self-hosted diagram editor for showing how successive controls reduce a quantity. The river is viewed from above. Two equal gate leaves close from opposite banks, span only the flow arriving at that control, and leave a centered opening for what remains. Later gates never borrow the width of the original river. Built for corporate presentation slides.

Curved banks, shaded water with restrained current lines, and ribbed gate panels with bank supports give the drawing an aerial river appearance. Every detail is vector geometry derived from the selected river color, gate color, and background, so company palettes and transparent exports remain usable. The curves shift the river without changing its measured water width. Bank shelves and gate supports are illustration, not additional flow.

<img width="1736" height="915" alt="image" src="https://github.com/user-attachments/assets/f03d9c8a-d415-4e09-afc5-d0700f152a1a" />


## Quick start

With Docker and Docker Compose installed, run from the repository directory:

```sh
docker compose up -d --build --wait
```

Open [http://localhost:8094](http://localhost:8094) on the Docker host. Saved diagrams persist in the `river-diagram-data` volume.

The default binding is `0.0.0.0:8094`, which listens on all host interfaces. To choose a different address or port, copy `.env.example` to `.env` and edit `RIVER_BIND_ADDRESS` and `RIVER_PORT` before starting. For access only from the Docker host, set `RIVER_BIND_ADDRESS=127.0.0.1`. With a remote Docker daemon, use that host's address in your browser.

The service intentionally has no authentication. Everyone who can reach it can read, edit, and delete its saved rivers. Use a trusted network or an authenticated reverse proxy for shared deployments. No analytics, external fonts, or external runtime services are used.

## Using it

1. Start with the email-security example or choose **New river → Blank river**.
2. Set the title, source label, and starting quantity. Counts accept commas and shorthand such as `4m`, `2.5k`, and `1b`.
3. Add controls and enter what remains. You can instead enter a removed count or a removal percentage. Counts are whole numbers; percentages round the resulting count to the nearest whole item.
4. Label the residual at each stage. For example, `4 phishing emails delivered`, then `0 incidents` after the final control.
5. Choose **Style** to use exact proportions or presentation widths, apply a theme, or apply a custom palette to all segments. Each control also has individual river and gate colors.
6. **Save river** gives the document a permanent `/r/your-name` URL. Subsequent edits save automatically. Changing the title preserves the URL; **Save a copy** creates a new URL.
7. **Export** creates a self-contained SVG or a 3840 × 2160 PNG. Both support transparency. SVG is the preferred scalable slide asset. JSON export/import preserves the editable model.
8. **Compare** selects a second saved river. The comparison places two vertical rivers side by side so the controls remain readable. Each river retains its own starting scale and scale disclosure. **Copy link** creates a URL that reopens the pair.
9. **Present** removes the editor and uses browser full-screen mode when available. Escape exits. Arrow keys change slides.

**Style → Control labels → Count label** changes the word after every removed count in this river. Use `blocked`, `removed`, `reduced`, `remediated`, or your own wording (up to 24 characters). Blank or older settings default to `blocked`. The setting follows saved URLs, copies, JSON import/export, presentation, SVG, and PNG. Each river in a comparison uses its own wording.

**Style → Control labels → Show reduction percentages** optionally adds the reduction at each gate. It is calculated as `(incoming − remaining) / incoming × 100`, using the immediately preceding stage. The setting is saved with the river and applies to the preview, comparison, SVG, and PNG exports. If no flow enters a control, the label says “No incoming flow.”

Existing rivers and imported files automatically use the gate drawing while retaining their quantities, labels, colors, and URLs.

Undo/redo is available in the toolbar, with Ctrl/Command Z and Ctrl/Command Shift Z outside text fields. Ctrl/Command S saves. Clicking a diagram label opens the corresponding control in the editor.

## Quantities and widths

The source must be a positive whole number. Every remaining quantity must lie between zero and the preceding quantity. If an earlier quantity is lowered below later quantities, those later quantities are clamped and the editor explains the change; Undo restores the prior state. A zero quantity draws no downstream water.

- **Exact (default for new rivers)**: width equals `260 × quantity / original source`. A reduction from 4 million to 2 million halves the width. Each gate leaf covers half the removed width, with neither leaf extending beyond the incoming river. Tiny residuals can be visually imperceptible, but their exact labels remain visible.
- **Presentation**: quantities at or above 10% of the source retain exact widths. Smaller quantities use a logarithmic tail with a minimum positive width of 4 SVG units. Zero remains exactly zero. Every slide explicitly discloses the adjusted scale. Gate openings and spans follow the adjusted river widths, rather than absolute quantities. This is an explicitly labeled illustrative mode. Percentage labels always use the underlying quantities.

A river supports 48 controls. Five appear on each 16:9 slide, with numbered continuation slides carrying the previous quantity forward. Export the currently selected slide; use the slide arrows to export each continuation. Comparison similarly advances through groups of five controls. Long labels are wrapped and fitted without truncating the content. Short, specific labels produce the strongest presentation.

The default example is illustrative. Replace its quantities and note with your own measured data or model assumptions. If labels change the unit, such as emails to incidents, explain that assumption in the source/note field.

## Implementation

- Go standard library HTTP server, embedded HTML/CSS/JavaScript, no third-party Go modules.
- Buildless browser JavaScript and native SVG/canvas rendering. No frontend framework or package installation at runtime.
- One JSON file per saved river, written with a synced temporary file and atomic rename.
- Revision checks reject stale writes from other tabs instead of overwriting newer saved data.
- Unsaved edits have browser recovery drafts. The UI reports failed saves and lets the user retry or save a separate copy on a revision conflict.
- Server-side validation covers colors, names, integer quantities, bounds, URLs, and control counts. Same-origin write checks, a restrictive CSP, request limits, and HTTP timeouts are configured.
- The release image contains only the compiled binary and license. It uses a read-only root filesystem, a dedicated writable data volume, no added capabilities, resource limits, and an automatic restart policy.

The Go build image is pinned by digest in `Dockerfile`. Browser verification uses temporary containers with Playwright and axe-core; these dependencies are not shipped in the application.

## Operations and development

See [DEPLOYMENT.md](DEPLOYMENT.md) for configuration, backups, source packaging, and container-based tests. No particular Docker context, host address, username, or checkout path is required.

## Files

- `main.go`: HTTP API, validation, durable storage, embedded assets.
- `web/diagram.js`: measured typography, river geometry, slide composition, comparison.
- `web/app.js`: editor, save/recovery workflow, exports, presentation.
- `web/style.css`, `web/index.html`: responsive interface.
- `main_test.go`: persistence, conflicts, invalid inputs, request boundaries, routes.
- `qa/e2e.cjs`: browser workflow checks.
- `qa/layout.cjs`: label bounds and collision checks over edge cases.
- `qa/inspect.cjs`: desktop/mobile captures and accessibility checks.
- `qa/accessibility.cjs`: responsive accessibility and presentation keyboard checks.
- `qa/gates.cjs`: gate attachment, openings, percentage calculations, visibility, export, and comparison checks.
- `qa/river-detail.cjs`: sampled cross-sections along curved water, gate connections, palette variants, transparent pixels, and unique SVG gradients.
- `qa/count-label.cjs`: count wording persistence, undo, comparisons, imports, exports, and accessibility.
- `qa/config.cjs`: shared test URL, dependency resolution, and artifact paths.
- `.env.example`: optional deployment settings; keep your `.env` private.
- `scripts/package-source.sh`: regenerate the downloadable source archive from an explicit source-file list.
- `QA.md`: verification record and validation boundaries.

## License and attribution

Created by mubix. Licensed under the [BSD 3-Clause License](LICENSE), using the [standard BSD 3-Clause terms](https://opensource.org/license/bsd-3-clause). The license is included in source archives and at `/LICENSE` inside the container image.
