# Kieran Document Studio（文档工作台）

[English](README.md) | [简体中文](README-CN.md) | 繁體中文


由 **Kieran Dai（GitHub：Chihang03；發布者：chihang03）** 獨立維護。本專案是基於 [cweijan/vscode-office](https://github.com/cweijan/vscode-office) 的**社群 fork**，不代表上游作者，也未獲得上游或 Microsoft 的官方背書。原版權、MIT 授權和 Git 歷史繼續保留，來源見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

獨立擴充功能 ID 為 **`chihang03.kieran-document-studio`**，預覽版本從 **0.1.0** 起單獨維護。它作為獨立擴充功能安裝，不會覆蓋 `cweijan.vscode-office`。可從本儲存庫建置 VSIX；後續發行包將在 [Releases](https://github.com/Chihang03/vscode-office/releases) 提供。品牌整改不表示已經通過 Marketplace 審核。設定、命令和自訂編輯器均使用獨立命名空間，舊設定遷移見[遷移說明](docs/migration.md)。

## 介紹

本擴充功能支援在 VS Code 中預覽以下常見的辦公檔案格式：

- Excel: `.xls`、`.xlsx`、`.xlsm`、`.csv`、`.ods`
- Word: `.docx`、`.dotx`
- PowerPoint: `.pptx`、`.pptm`
- PDF 與電子書: `.pdf`、`.epub`
- HEIC/TIFF: `.heic`、`.heif`、`.tiff`
- 設計檔案: `.psd`、`.xmind`、`.icns`、`.svg`
- 字型: `.ttf`、`.otf`、`.woff`、`.woff2`
- Markdown: `.md`、`.markdown`
- HTML: `.html`、`.htm`
- HTTP 請求: `.http`、`.rest`
- Java: `.class`（反編譯）
- 壓縮檔案: `.zip`、`.jar`、`.vsix`、`.rar`、`.7z`、`.tar`、`.tar.gz`、`.tgz`、`.apk`

CSV、TSV、Excel 和 ODS 表格開啟後，會按內容自動適配目前工作表的欄寬；其他工作表在第一次切換到它時才執行，恢復上次查看的工作表也遵循此規則，不會因此將檔案標記為已修改。之後手動調整的欄寬在編輯和切換工作表時保留；仍可點擊 AF 按鈕再次適配。

## Git 歷史

Kieran Document Studio 內建完整的 Git 歷史工作區，讓你無需離開 VS Code 即可瀏覽儲存庫。可從原始碼控制檢視、編輯器標題列、編輯器右鍵選單或檔案總管右鍵選單開啟。


## Markdown

整合 Markdown 所見即所得編輯器。

如需使用 VS Code 原生 Markdown 編輯器，請在 `settings.json` 中新增以下設定：

```json
{
    "workbench.editorAssociations": {
        "*.md": "default",
        "*.markdown": "default"
    }
}
```

可從命令面板（`Kieran Document Studio：匯出 Markdown 為 PDF`）、編輯器標題列，或 Markdown 編輯器／檔案右鍵選單匯出 PDF。匯出時先選擇儲存位置，再同步並儲存待儲存的編輯內容。每頁左上角顯示來源檔名，右上角顯示本地匯出日期（`YYYY-MM-DD`），底部置中顯示「目前頁 / 總頁數」。PDF 根據 Markdown 一至六級標題產生可點擊的分層書籤，並提示檢視器開啟大綱側欄；是否自動展開由檢視器決定。正文不插入目錄，`[toc]` 目錄指令仍不呈現，也不會因此修改來源檔案。需要已安裝 Chrome、Edge 或 Chromium；自動偵測失敗時可設定 `kieran-document-studio.chromiumPath`。自訂編輯器右鍵選單繼續支援 DOCX 和 HTML 匯出。


快捷鍵：基於 [shortcut.md](shortcut.md)，以及：

- 新行: `Ctrl+Enter` / `⌘ Enter`
- 硬換行: `Shift+Enter` / `⇧ Enter`
- 編輯超連結: `Alt+Enter` / `^ Enter`
- 設定 CodeMirror 語言: `Alt+Enter` / `^ Enter`
- 在 VS Code 中編輯: `Ctrl Alt E` / `⌘ ^ E`
- 貼上為純文字: `Ctrl+Shift+V` / `⌘ ⇧ V`

## 其他功能

- HTML: 編輯時按下 `Ctrl+Shift+V` 可即時預覽
- YAML: 支援文件大綱與錨點導覽（別名引用可跳轉到定義）
- 圖示主題: 內建 [Material Icon Theme](https://github.com/PKief/vscode-material-icon-theme) 部分圖示，並提供 **Material Icons (Kieran Document Studio)** 與 **One Dark Modern (Kieran Document Studio)** 配色主題
- Excel: 支援預覽與儲存 `.xlsx`、`.xls`、`.xlsm`、`.csv`、`.ods` 等檔案
- HTTP: 在 `.http`、`.rest` 檔案中傳送請求（整合自 [REST Client](https://github.com/Huachao/vscode-restclient)，並修正了本地請求的已知問題）；按 `Ctrl+Enter` / `⌘ Enter` 傳送
- Java: 開啟 `.class` 檔案可反編譯並查看原始碼

## 開發指南

### 環境要求

- [Node.js](https://nodejs.org/) 24（已驗證的建置與打包環境）
- [VS Code](https://code.visualstudio.com/) 1.64+

### 快速開始

```bash
git clone https://github.com/Chihang03/vscode-office.git
cd vscode-office
npm ci
```

### 開發除錯

**桌面端擴充功能**（完整功能）：

```bash
npm run dev
```

在 VS Code 中按 `F5`，或在「執行和偵錯」中選擇 **Extension**。

**Web 端擴充功能**（瀏覽器中的 Markdown、HTML、YAML）：

```bash
npm run dev:web
```

在「執行和偵錯」中選擇 **Extension (Web)**。

### 建置與打包

```bash
npm run build    # 生產建置
npm run package  # 產生 .vsix
```

## 使用資料

此社群 fork **不配置遙測接收端，也不傳送擴充功能使用事件**。繼承的 Application Insights 連線已移除。保留的 `kieran-document-studio.enableTelemetry` 設定預設為 `false`；本建置中將它設為 `true` 也不會開啟上報。維護說明見 [docs/telemetry.md](docs/telemetry.md)。

主動執行 HTTP 請求、載入文件中的遠端資源和使用 AI 功能，仍會存取各自配置的服務；這些功能與擴充功能使用遙測分開處理。

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
