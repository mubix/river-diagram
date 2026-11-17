# Verification record

## Public source preparation, 2026-11-16

- The eight Go test groups pass. The Docker image builds, its health check passes, and its `/LICENSE` matches the repository license.
- All seven browser scripts pass against an isolated instance using `BASE_URL` and `QA_OUTPUT_DIR` overrides: 19 end-to-end workflows, 22 layout cases, desktop/mobile inspection, five accessibility contexts and presentation keyboard checks, gate geometry, six river-rendering cases, and eight count-label workflows.
- Compose resolves both the default binding and a custom loopback address and port. The shared browser configuration resolves default and overridden URLs, output directories, dependencies, and source paths.
- The working tree and source archive pass checks for private network addresses, personal host paths, email addresses, and common credential patterns. An archive-exclusion check with local settings, saved data, backups, keys, Git metadata, and generated QA reports present confirms that only the explicit source list is packaged.

## Configurable count label, 2026-11-16

- The Go suite passes, including omitted settings in legacy files and API requests, persistence after reopening storage, custom wording, whitespace normalization, the blank default, and rejection of long or non-text labels. Reading a legacy file leaves its bytes unchanged.
- Eight focused browser workflows pass against both an isolated preview and a test deployment: editing/undo/redo; save/reload/editor wording; auto-save with optional percentages; presentation and SVG/PNG exports; JSON round trip; independent comparison labels; blank defaults and safe text escaping; accessible input and mobile layout.
- All 22 layout cases pass, including maximum-length custom wording, large counts, long control names, and comparisons. Count and percentage labels remain separate.
- The new style input and rendered wording were visually reviewed.

## Earlier full release verification

Curved riverbanks and detailed aerial-gate revision verified on 2026-11-16 against a test deployment. The entries below record that earlier verification; see [DEPLOYMENT.md](DEPLOYMENT.md) to reproduce the checks in your own environment.

## Passed

- Seven Go test groups cover persistent saves, URL uniqueness, concurrent/stale edits, invalid inputs, HTTP boundaries, empty and long models, static routes, and the percentage-visibility preference. The new preference test covers omitted legacy settings, explicit false, restoring true, and rejection of nonboolean values.
- 19 browser workflows passed: initial river renders 4 million through zero without a final water segment; exact scale has a 2:1 width ratio; presentation keeps 4 visible; zero stays zero; save a named river at a stable URL; edit labels and shorthand quantities; autosave and reload; invalid remaining quantity blocks save and is recoverable; quantity entry by removed count and percentage; theme applies to every segment, individual colors persist, custom palette applies all; percentage visibility persists across save and reload; add controls, paginate, remove, undo and redo; safe copy creates a second named URL without modifying the first; compare two saved rivers, share comparison URL, and present; SVG export is self-contained, safe, and labeled; PNG export is 3840 by 2160 and transparent export has alpha; JSON export and import preserve model without overwriting a saved URL; mobile and tablet layouts stay within the viewport; saved library searches and opens the correct river; conflicting tabs preserve newer server edits; network failure retains a draft and retry saves it; all interactions complete without browser script errors.
- Gate checks use actual SVG leaf bounding boxes and the water cross-section at the gate: both leaves have equal spans, stay within the incoming river, leave a centered opening, and meet the next segment within 0.001 SVG units. Comparison gates are checked on both banks as well. No full-height frames extend above later-stage rivers.
- A 4-million-to-2-million reduction leaves a 130-unit centered opening in a 260-unit incoming flow, with each leaf blocking 65 units. The endpoint gate is bounded by its four-email incoming stream; its drawn blocked span is less than one hundred-thousandth of the first gate’s span. Exact scale is the default for new rivers. Fully open and fully closed cases are checked; zero produces no downstream water.
- Reduction labels use the immediately preceding quantity: the example's first two controls display 50% and 99.4%. The setting hides labels in the preview, SVG export, and comparison view, and persists across saving, reload, and JSON import.
- 18 slide-layout cases passed with no text collisions or out-of-bounds labels, including maximum-length labels, 48 controls across ten slides, large quantities, zero outcomes, and comparisons.
- Five axe contexts passed with no WCAG 2 A/AA or WCAG 2.1 AA violations: desktop editor, style controls, dark slide theme, 320px mobile editor, and 390px mobile editor.
- Presentation focus containment, arrow-key navigation, Escape, and focus restoration passed.
- SVG exports are valid XML and self-contained. PNG exports are 3840 × 2160; transparent export alpha was verified.
- Curved water cross-sections were sampled at seven positions per reach with Chromium SVG hit-testing; widths and gate attachments matched within 0.002 SVG units (browser float tolerance). Decorative banks never count toward water width.
- Six rendering cases passed: exact, presentation, dark, custom burgundy/gold, white water on dark, and fully closed followed by zero incoming flow. Gradient references resolve, adjacent drawings have unique IDs, and transparent SVG rasterization has zero-alpha corners with opaque water and banks.
- The river, bank shelves, ribbed gate panels, comparison slide, application mark, and explanatory icon were visually reviewed. Gate colors remain individually editable and work with company palettes.
- No existing river records were present at the start of this revision. Legacy file compatibility is covered by Go/API checks. Test-created rivers are deleted by the browser suite.

## Validation boundaries

Browser automation used Chromium in a Playwright container. Native PowerPoint/Keynote import, Safari, and Firefox were not automated. PNG captures the rendered slide; SVG uses system sans-serif fonts. The example values are illustrative, not measured telemetry. Generated test reports and screenshots are local artifacts, excluded from Git and the source download.
