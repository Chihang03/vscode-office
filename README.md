# Kieran Document Studio（文档工作台）

English | [简体中文](README-CN.md) | [繁體中文](README-TW.md)


Maintained independently by **Kieran Dai** (GitHub: **Chihang03**; publisher: **chihang03**). This is a **community fork of [cweijan/vscode-office](https://github.com/cweijan/vscode-office)**. It is not an official upstream release and is not endorsed by the upstream authors or Microsoft. Original copyrights, MIT license, and Git history are retained; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The independent extension ID is **`chihang03.kieran-document-studio`**, starting at preview version **0.1.0**. It installs separately from `cweijan.vscode-office`. Use a VSIX built from this repository; future release packages will be listed under [Releases](https://github.com/Chihang03/vscode-office/releases). This branding revision does not establish Marketplace approval. Settings, commands and custom editor IDs have independent namespaces; see the [migration guide](docs/migration.md).

## Introduction

This extension lets you preview and edit common office and design files directly in VS Code.

- Excel: `.xls`, `.xlsx`, `.xlsm`, `.csv`, `.ods`
- Word: `.docx`, `.dotx`
- PowerPoint: `.pptx`, `.pptm`
- PDF & eBook: `.pdf`, `.epub`
- HEIC/TIFF: `.heic`, `.heif`, `.tiff`
- Design: `.psd`, `.xmind`, `.icns`, `.svg`
- Font: `.ttf`, `.otf`, `.woff`, `.woff2`
- Markdown: `.md`, `.markdown`
- HTML: `.html`, `.htm`
- HTTP request: `.http`, `.rest`
- Java: `.class` (decompiler)
- Compressed files: `.zip`, `.jar`, `.vsix`, `.rar`, `.7z`, `.tar`, `.tar.gz`, `.tgz`, `.apk`

CSV, TSV, Excel, and ODS columns automatically fit their contents when the current worksheet is first displayed. Other worksheets are fitted only when first opened, including a restored active sheet. Initial fitting does not mark the file as modified. Manual resizing is preserved during editing and sheet switching; the AF button still fits columns on demand.

## Git History

Kieran Document Studio includes a full Git History workspace for exploring repositories without leaving VS Code. Open it from the Source Control view, the editor title bar, the editor context menu, or the file explorer context menu.


## Markdown

This extension replaces the default Markdown editor with a WYSIWYG editor.

Hover over a Mermaid diagram and choose **Edit diagram visually** to edit flowchart nodes, edges, labels, shapes, colours, stroke widths and layout direction. Use **Connect** and select two nodes, or drag between nodes, to add an edge. The properties panel also supports subgraph creation, renaming, deletion and membership changes. Selecting a shape locates its source; moving the source caret locates the corresponding shape.

The editor includes draft undo/redo, source editing and live preview. **Apply** updates the original standard `mermaid` code block as an undoable document edit; **Cancel** discards the draft. Visual editing covers common `flowchart` / `graph` syntax, while other diagram types and advanced syntax retain source editing and preview. Most property edits preserve surrounding source; membership changes reorganise structural declarations while retaining comments, configuration and styles. Mermaid computes the layout automatically. If the original block changes while the panel is open, the draft is retained and a stale overwrite is refused.

To use the built-in VS Code Markdown editor instead, add this to your `settings.json`:

```json
{
    "workbench.editorAssociations": {
        "*.md": "default",
        "*.markdown": "default"
    }
}
```

Export PDF from the command palette (`Kieran Document Studio: Export Markdown to PDF`), the editor title toolbar, or the Markdown editor/file context menu. Choose a destination before exporting; pending editor changes are synchronized and saved first. Every page has the source filename at the top left, the local export date (`YYYY-MM-DD`) at the top right, and centered `current page / total pages` at the bottom. PDF export creates nested, clickable bookmarks from Markdown heading levels 1–6 and requests the outline sidebar on open. The body has no inserted table of contents; `[toc]` directives remain suppressed without changing the source. Automatic sidebar opening depends on the viewer. PDF export requires an installed Chrome, Edge, or Chromium; configure `kieran-document-studio.chromiumPath` if automatic detection fails. DOCX and HTML export remain available in the custom editor context menu.


Shortcuts: Based on [shortcut.md](shortcut.md), plus:

- New line: `Ctrl+Enter` / `⌘ Enter`
- Hard line break: `Shift+Enter` / `⇧ Enter`
- Edit hyperlink: `Alt+Enter` / `^ Enter`
- Set CodeMirror language: `Alt+Enter` / `^ Enter`
- Edit in VS Code: `Ctrl Alt E` / `⌘ ^ E`
- Paste as plain text: `Ctrl+Shift+V` / `⌘ ⇧ V`

## Diagram editing (Draw.io format)

Open `.drawio`, `.dio`, `.drawio.svg` or `.drawio.png` files with **Kieran Document Studio: Diagram Editor**, or use the **New Diagram / Open Diagram** commands. The bundled draw.io 32.4.1 engine works offline and does not require another extension. Edit shapes, text, connectors and pages; use Save or Ctrl/Cmd+S to save through VS Code. XML/SVG use text document dirty state and undo/redo; PNG retains embedded diagram data, native undo/redo and backup support. Export SVG/PNG produces images with editable diagram metadata. Ordinary SVG/PNG files continue to use the existing viewers. If another Draw.io extension is installed, select the desired editor using **Reopen Editor With**.

Unsaved diagram edits remain in VS Code rather than automatically writing to disk. External XML changes update the canvas; simultaneous edits with stale versions are rejected with a reload message. Git/read-only sources support preview and export. Cloud integrations, plugins, code links and Live Share are outside this first integration. The offline engine raises the minimum VS Code version to **1.95**. The independent adapter is maintained by Kieran Dai; the engine and bundled assets retain their upstream notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Audio viewing

Open an audio file, or choose **Reopen Editor With → Kieran Document Studio Audio Viewer**. The viewer is read-only and waits for you to press Play. It provides per-channel waveforms, a time ruler and playhead, click-to-seek, speed, volume and mute controls. Drag to select a segment and enable **A–B loop**. Use the wheel or zoom buttons to magnify the waveform, drag in **Pan** mode (or Shift-drag) to move, use the overview to navigate, and **Full track** to reset. Playback position is remembered in the workspace; waveforms are cached by file version.

PCM and IEEE float WAV waveforms are processed incrementally in a local worker; sample rate, channel count and bit depth come from the source header. MP3, FLAC, OGG/Opus, M4A/AAC, AIFF and audio WebM use the decoder available in your VS Code build, so support can vary by codec and platform. Their displayed sample rate is the **decoded** rate. Generic waveform decoding is limited to 32 MiB encoded data, with a conservative duration preflight and a 128 MiB decoded-data check. When waveform generation is unavailable or cancelled, supported native playback remains available. Virtual/remote files are limited to 16 MiB. Waveforms show up to eight channels; A–B loops use the media playback clock and are intended for listening, not sample-accurate editing.

Expand **Audio analysis** to inspect original uncompressed PCM / IEEE float WAV samples. Choose an individual channel or compare channels 1 and 2, set the FFT size and frequency bounds, and switch between linear and logarithmic frequency. The FFT spectrum analyzes the selection, or the visible waveform range without a selection. The spectrogram follows waveform zoom and pan; click it to seek or drag to create the shared selection. The **900–1,100 Hz** shortcut focuses on a 1 kHz AM carrier and its sidebands. The modulation spectrum extracts a Hilbert envelope within the chosen frequency band and displays 0–120 Hz with configurable reference lines such as `37, 47`.

Spectra use a coherent-gain-corrected Hann window and sine peak amplitude in dBFS (full-scale peak = 0 dBFS). The selection spectrum averages power from at most 64 evenly spaced windows. The spectrogram samples at most 160 evenly spaced windows; long views can have gaps between windows, so zoom in to inspect brief events. Envelope analysis uses the first ≤8 seconds / 524,288 samples of the analysis range, trims up to 50 ms from each edge, removes DC and normalizes to mean envelope; its dB reference is not dBFS. Actual time ranges, FFT bin spacing and window duration are shown; bin spacing is not resolving power. Computation runs locally in a cancellable worker, with the last three parameter results cached in the current preview's memory. File analysis does not replace acoustic measurements or EEG / ASSR validation.

Analysis preferences (FFT size, channel, frequency bounds, scale and modulation references) are saved in the current VS Code profile across files and restarts. New previews always start collapsed and create no analysis worker until expanded. Mono and lower-rate files adapt incompatible channels and bounds without overwriting saved preferences on initialization.

## Image viewing

In **Zoom** mode, scroll over the image to zoom around the pointer. Drag an enlarged image to inspect its edges; double-click the image or select **Fit** to restore the centered view. **Browse** uses the wheel to switch images. Arrow and thumbnail navigation remain available and reset the view for the next image.

## Other features

- HTML: live preview while editing; press `Ctrl+Shift+V` to open the live view
- YAML: document outline and anchor navigation (Go to Definition for alias references)
- Icon theme: includes a subset of [Material Icon Theme](https://github.com/PKief/vscode-material-icon-theme) icons, plus **Material Icons (Kieran Document Studio)** and **One Dark Modern (Kieran Document Studio)** color themes
- Excel: preview and save `.xlsx`, `.xls`, `.xlsm`, `.csv`, and `.ods` files
- HTTP: send requests from `.http` and `.rest` files (integrated from [REST Client](https://github.com/Huachao/vscode-restclient) with fixes for local request issues); press `Ctrl+Enter` / `⌘ Enter` to send
- Java: decompile and view `.class` files

## Development Guide

### Prerequisites

- [Node.js](https://nodejs.org/) 24 (tested build and packaging runtime)
- [VS Code](https://code.visualstudio.com/) 1.95+

### Getting started

```bash
git clone https://github.com/Chihang03/vscode-office.git
cd vscode-office
npm ci
```

### Development

**Desktop extension** (full feature set):

```bash
npm run dev
```

Press `F5` in VS Code, or choose **Extension** from Run and Debug.

**Web extension** (Markdown, HTML, YAML in the browser):

```bash
npm run dev:web
```

Choose **Extension (Web)** from Run and Debug.

### Build & package

```bash
npm run build    # production build
npm run package  # create an independent chihang03 VSIX
```

## Usage data

This community fork ships **without a telemetry endpoint** and does not send extension usage events. The inherited Application Insights connection has been removed. The reserved `kieran-document-studio.enableTelemetry` setting defaults to `false`; setting it to `true` alone does not enable reporting in this build. See [docs/telemetry.md](docs/telemetry.md).

User-triggered HTTP requests, remote document resources and AI features still use their configured services. They are separate from extension usage telemetry.

## Credits

- PDF rendering: [mozilla/pdf.js](https://github.com/mozilla/pdf.js/)
- DOCX rendering: [VolodymyrBaydalka/docxjs](https://github.com/VolodymyrBaydalka/docxjs)
- PPTX rendering: [pptxviewjs](https://www.npmjs.com/package/pptxviewjs)
- XLSX rendering:
  - [SheetJS/sheetjs](https://github.com/SheetJS/sheetjs): XLSX parsing
  - [myliang/x-spreadsheet](https://github.com/myliang/x-spreadsheet): XLSX rendering
- EPUB: [futurepress/epub.js](https://github.com/futurepress/epub.js)
- PSD: [ag-psd](https://github.com/Agamnentzar/ag-psd)
- XMind: [mind-elixir](https://github.com/ssshooter/mind-elixir-core), [@mind-elixir/import-xmind](https://github.com/ssshooter/mind-elixir-core)
- HEIC conversion: [heic2any](https://github.com/alexcorvi/heic2any)
- Java decompiler: [JetBrains/java-decompiler](https://github.com/JetBrains/intellij-community/tree/master/plugins/java-decompiler/engine)
- HTTP: [REST Client](https://github.com/Huachao/vscode-restclient)
- Markdown: [Vanessa219/vditor](https://github.com/Vanessa219/vditor)
- Material Icon theme: [PKief/vscode-material-icon-theme](https://github.com/PKief/vscode-material-icon-theme)
