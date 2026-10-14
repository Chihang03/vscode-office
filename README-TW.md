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

## 圖形編輯（Draw.io 格式）

支援 `.drawio`、`.dio`、`.drawio.svg` 與 `.drawio.png`，可選擇 **Kieran Document Studio 圖形編輯器** 開啟，或使用命令面板的 **新增圖形 / 開啟圖形**。內建 draw.io 32.4.1 離線核心，無需另裝擴充套件；可以編輯形狀、文字、連線與頁面，透過儲存按鈕或 Ctrl/Cmd+S 儲存。XML/SVG 使用 VS Code 文字文件的未儲存標記與復原重做；PNG 保留內嵌圖形資料，並支援原生復原重做與備份。匯出的 SVG/PNG 也保留可繼續編輯的圖形資料。普通 SVG/PNG 仍使用原來的檢視器。同時安裝其他 Draw.io 擴充套件時，可透過 **重新開啟編輯器方式** 選擇。

修改先保留在 VS Code 未儲存緩衝區，不會每次修改就寫入磁碟。外部 XML 更新會同步至畫布；版本過期的並行修改會被拒絕並提示重新載入。Git 或唯讀來源可預覽與匯出。首版不含雲端儲存、外掛、程式碼連結或 Live Share。最低 VS Code 版本調整為 **1.95**。適配由 Kieran Dai 獨立維護，核心及素材保留原始來源與許可，詳見 [第三方說明](THIRD_PARTY_NOTICES.md)。

## 音訊檢視

開啟音訊檔案，或選擇 **重新開啟編輯器方式 → Kieran Document Studio 音訊檢視器**。音訊為唯讀預覽，點擊播放後才開始播放。介面提供分聲道波形、時間軸與播放線、點擊定位、倍速、音量及靜音控制。在波形上拖曳選取後可啟用 **A–B 循環**。滾輪或縮放按鈕放大波形，切換 **平移** 模式拖曳（也可按住 Shift 拖曳），下方總覽可快速導覽，**完整音軌** 恢復全貌。工作區會記住播放位置，波形依檔案版本快取。

PCM 與 IEEE 浮點 WAV 在本機 worker 中串流計算波形，取樣率、聲道數與位元深度直接來自檔案標頭。MP3、FLAC、OGG/Opus、M4A/AAC、AIFF 與音訊 WebM 依賴目前 VS Code 的解碼器，支援情況隨編碼與平台變化，介面顯示的是**解碼取樣率**。這些格式的波形計算限制為 32 MiB 編碼資料，並進行保守的時長預檢及 128 MiB 解碼資料檢查。無法產生波形或取消計算時，已支援的原生播放仍可使用。虛擬或遠端檔案限 16 MiB。波形最多顯示八個聲道；A–B 循環使用媒體播放時鐘，適合試聽，不用於取樣點級剪輯。

## 圖片檢視

在 **Zoom** 模式下，滾輪圍繞滑鼠位置縮放，按住滑鼠左鍵拖曳放大後的圖片可查看邊緣。按兩下圖片或點擊 **Fit** 恢復置中的適應視窗檢視。**Browse** 模式下滾輪切換圖片；箭頭和縮圖也可切圖，切圖時會重設縮放和平移。

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
- [VS Code](https://code.visualstudio.com/) 1.95+

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
