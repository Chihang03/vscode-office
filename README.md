# Office Viewer (Chihang03)

This is [Chihang03's fork](https://github.com/Chihang03/vscode-office) of [cweijan/vscode-office](https://github.com/cweijan/vscode-office), based on upstream `main` commit `908258dafc827ce0475fe7671d414914fbd3867b`. The original MIT license and third-party notices are retained.

This fork adds Markdown-to-PDF commands to the command palette, editor toolbar, editor context menu, and file explorer context menu. Select a `.md` or `.markdown` file, run **Office Viewer: Export Markdown to PDF**, and choose the destination. It waits for pending editor updates and source-file saving, shows export progress, and offers to open the completed PDF. Cancelling the destination dialog stops the export.

PDF pages show the source filename at the top left, the local export date (`YYYY-MM-DD`) at the top right, and centered `page / total` numbers at the bottom. No table of contents or PDF bookmark directory is generated; rendered `[toc]` directives are omitted from the PDF without changing the source. Header/footer space is reserved automatically.

PDF export requires a Chromium browser on the extension host (Chrome, Edge, or Chromium). Set `vscode-office.chromiumPath` if automatic detection fails. Browser-only VS Code is not supported; remote SSH/container use requires the browser to be installed in that remote environment. For local testing, disable the upstream Office Viewer extension because the fork currently retains its command and editor IDs.


English | [简体中文](README-CN.md) | [繁體中文](README-TW.md)

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

## Git History

Office Viewer includes a full Git History workspace for exploring repositories without leaving VS Code. Open it from the Source Control view, the editor title bar, the editor context menu, or the file explorer context menu.

![1783342874748](image/README/1783342874748.png)

## Markdown

This extension replaces the default Markdown editor with a WYSIWYG editor.

To use the built-in VS Code Markdown editor instead, add this to your `settings.json`:

```json
{
    "workbench.editorAssociations": {
        "*.md": "default",
        "*.markdown": "default"
    }
}
```

Right-click in the editor to export Markdown to PDF, DOCX, or HTML. PDF export requires Chromium; set the browser path with `vscode-office.chromiumPath`.

![Export Markdown](image/README-CN/1685418034035.png)

Shortcuts: Based on [shortcut.md](shortcut.md), plus:

- New line: `Ctrl+Enter` / `⌘ Enter`
- Hard line break: `Shift+Enter` / `⇧ Enter`
- Edit hyperlink: `Alt+Enter` / `^ Enter`
- Set CodeMirror language: `Alt+Enter` / `^ Enter`
- Edit in VS Code: `Ctrl Alt E` / `⌘ ^ E`
- Paste as plain text: `Ctrl+Shift+V` / `⌘ ⇧ V`

## Other features

- HTML: live preview while editing; press `Ctrl+Shift+V` to open the live view
- YAML: document outline and anchor navigation (Go to Definition for alias references)
- Icon theme: includes a subset of [Material Icon Theme](https://github.com/PKief/vscode-material-icon-theme) icons, plus **Office Material Icon Theme** and **One Dark Modern** color themes
- Excel: preview and save `.xlsx`, `.xls`, `.xlsm`, `.csv`, and `.ods` files
- HTTP: send requests from `.http` and `.rest` files (integrated from [REST Client](https://github.com/Huachao/vscode-restclient) with fixes for local request issues); press `Ctrl+Enter` / `⌘ Enter` to send
- Java: decompile and view `.class` files

## Sponsor

[![Database Client](https://doc.database-client.com/public/logo.png)](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-database-client2)

Database Client for Visual Studio Code, supporting the management of **MySQL/MariaDB, PostgreSQL, SQLite, Redis**, and **ElasticSearch**, and works as an **SSH** client to boost your productivity! [Get it now](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-database-client2).

## Development Guide

### Prerequisites

- [Node.js](https://nodejs.org/) 22.12+
- [VS Code](https://code.visualstudio.com/) 1.64+

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
npm run package  # create .vsix
```

## Validation

```sh
npm run test:pdf         # save, cancellation, failure, destination, cleanup checks
npm run build
npm run test:pdf:smoke   # generates out/pdf-smoke/sample.pdf with an installed browser
npm run package         # creates the VSIX; does not publish it
```

Use `OFFICE_PDF_CHROMIUM_PATH` to specify the browser executable for the smoke test. Inspect the generated PDF for Chinese text, tables, code, math, Mermaid diagrams, and the local image. Windows, Linux, and remote extension-host behavior still need validation on those hosts.

## Usage data

This fork disables extension telemetry and removes the upstream Application Insights connection string. To add telemetry later, configure your own service and update the disclosure before enabling it.

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
