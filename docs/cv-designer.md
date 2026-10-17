# CV Studio

The current library is `/candidate/cvs`. Compact cards show the actual ATS summary, modified date, principal badge and version. Their menu offers view, edit, primary, download, rename and delete. “Ajouter un CV” offers direct PDF import, manual creation and guided creation. Upload size and parsing remain backend-controlled. The library never embeds the document.

`/candidate/cvs/:id` is a read-only PDF.js viewer with a separate ATS tab. “Modifier le CV” opens a choice between manual editing and assisted improvement. Structured drafts live at `/candidate/cvs/drafts/:id`; `/candidate/cv-builder` remains a compatible entry point.

The editor uses a versioned document contract with stable section, entry and bullet IDs. Sections can be added, hidden, reordered, duplicated or removed. Fields are contextual; descriptions support emphasis and links; achievements are independently editable and reorderable. Templates use the actual document content. Eight deliberate single-column layouts preserve reading order, with controlled fonts, size, margins, spacing and accent colors.

Desktop has independently scrolling tools and document pages. Mobile switches between editing and preview. Page fit, readable width, zoom and fullscreen operate on A4 pages. Selecting a section focuses its preview. Info controls show the EasyJob coach on hover/focus, dismiss on exit, and can be pinned by click/tap for actions. Warnings take precedence over strengths when they share a target.

Autosave debounces real changes, uses optimistic version checks, preserves typing during pending requests and exposes network/conflict errors. Prior complete document snapshots can be restored as a new version. Undo/redo and independent duplication are available. Save opens the approval modal; verified publication creates a library PDF while preserving the original. Repeated publication of an already approved unchanged version returns the same library object.

Preview and export share escaped HTML and bounded CSS. PDF generation uses the existing Python/PyMuPDF service, verifies the complete extracted word sequence and retains links. Browser and MuPDF line metrics can differ slightly at page boundaries; exact pixel/pagination equivalence is not asserted. Exports fail explicitly instead of silently dropping text.

ATS scores come from the existing backend rules and explainable audit dimensions. Unsaved content hides outdated findings. A proposal compares original and new wording, accepts additional verified facts and allows adjustment, regeneration, rejection or explicit application. Template selection never fabricates a score increase. The local rule-based provider performs conservative factual rewrites; general generative wording requires the existing configured model provider.

Guided creation asks progressive contextual questions and records each answer in the backend while building the document. Experience questions repeat as requested and irrelevant branches are skipped. Refresh and resume retain answers. The branching is deterministic; the configured AI provider handles wording proposals. Imported ambiguous text remains available and marked for review instead of silently guessing its structure.

## Coach asset

Output: `web/public/images/coach/easyjob-builder.png`.
Generated with the built-in imagegen tool from `web/public/images/coach/easyjob-human-transparent.png`.

Final prompt:

> Use case: identity-preserve. Edit target is the attached EasyJob coach sprite sheet. Create ONE isolated waist-up portrait of the same man, preserving his face, age, hair, friendly expression and photorealistic style. Dress him as a construction worker: yellow hard hat and orange reflective safety vest over his navy EasyJob shirt. He holds a slim clipboard at waist level and gestures reassuringly with one open hand. Keep the white EasyJob brand text if visible. Single centered person, no duplicate poses. Transparent background with actual alpha. Full hard hat and both arms within frame, no surrounding objects, no caption or watermark. This asset will appear in the app while a CV is being built.
