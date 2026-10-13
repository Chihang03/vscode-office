# Kieran Document Studio（文档工作台）

[English](README.md) | 简体中文 | [繁體中文](README-TW.md)


由 **Kieran Dai（GitHub：Chihang03；发布者：chihang03）** 独立维护。本项目是基于 [cweijan/vscode-office](https://github.com/cweijan/vscode-office) 的**社区 fork**，不代表上游作者，也未获得上游或 Microsoft 的官方背书。原版权、MIT 许可证和 Git 历史继续保留，来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

独立扩展 ID 为 **`chihang03.kieran-document-studio`**，预览版本从 **0.1.0** 起单独维护。它作为单独扩展安装，不会覆盖 `cweijan.vscode-office`。可从本仓库构建 VSIX；后续发行包将在 [Releases](https://github.com/Chihang03/vscode-office/releases) 提供。品牌整改不表示已经通过 Marketplace 审核。设置、命令和自定义编辑器均使用独立命名空间，旧配置迁移见[迁移说明](docs/migration.md)。

## 介绍

本扩展支持在 VS Code 中预览以下常见的办公文件格式：

- Excel: `.xls`、`.xlsx`、`.xlsm`、`.csv`、`.ods`
- Word: `.docx`、`.dotx`
- PowerPoint: `.pptx`、`.pptm`
- PDF 与电子书: `.pdf`、`.epub`
- HEIC/TIFF: `.heic`、`.heif`、`.tiff`
- 设计文件: `.psd`、`.xmind`、`.icns`、`.svg`
- 字体: `.ttf`、`.otf`、`.woff`、`.woff2`
- Markdown: `.md`、`.markdown`
- HTML: `.html`、`.htm`
- HTTP 请求: `.http`、`.rest`
- Java: `.class`（反编译）
- 压缩文件: `.zip`、`.jar`、`.vsix`、`.rar`、`.7z`、`.tar`、`.tar.gz`、`.tgz`、`.apk`

## Git 历史

Kieran Document Studio 内置完整的 Git 历史工作区，让你无需离开 VS Code 即可浏览仓库。可从源代码管理视图、编辑器标题栏、编辑器右键菜单或文件资源管理器右键菜单打开。


## Markdown

集成 Markdown 所见即所得编辑器。

如需使用 VS Code 原生 Markdown 编辑器，请在 `settings.json` 中添加以下配置：

```json
{
    "workbench.editorAssociations": {
        "*.md": "default",
        "*.markdown": "default"
    }
}
```

可从命令面板（`Kieran Document Studio：导出 Markdown 为 PDF`）、编辑器标题栏，或 Markdown 编辑器／文件右键菜单导出 PDF。导出时先选择保存位置，再同步并保存待保存的编辑内容。每页左上角显示源文件名，右上角显示本地导出日期（`YYYY-MM-DD`），底部居中显示“当前页 / 总页数”。PDF 根据 Markdown 一至六级标题生成可点击的分层书签，并提示查看器打开大纲侧栏；是否自动展开由查看器决定。正文不插入目录，`[toc]` 目录指令仍不渲染，也不会因此修改源文件。需要已安装 Chrome、Edge 或 Chromium；自动检测失败时可设置 `kieran-document-studio.chromiumPath`。自定义编辑器右键菜单继续支持 DOCX 和 HTML 导出。


快捷键：基于 [shortcut.md](shortcut.md)，以及：

- 新行: `Ctrl+Enter` / `⌘ Enter`
- 硬换行: `Shift+Enter` / `⇧ Enter`
- 编辑超链接: `Alt+Enter` / `^ Enter`
- 设置 CodeMirror 语言: `Alt+Enter` / `^ Enter`
- 在 VS Code 中编辑: `Ctrl Alt E` / `⌘ ^ E`
- 粘贴为纯文本: `Ctrl+Shift+V` / `⌘ ⇧ V`

## 其他功能

- HTML: 编辑时按下 `Ctrl+Shift+V` 可实时预览
- YAML: 支持文档大纲与锚点导航（别名引用可跳转到定义）
- 图标主题: 内置 [Material Icon Theme](https://github.com/PKief/vscode-material-icon-theme) 部分图标，并提供 **Material Icons (Kieran Document Studio)** 与 **One Dark Modern (Kieran Document Studio)** 配色主题
- Excel: 支持预览和保存 `.xlsx`、`.xls`、`.xlsm`、`.csv`、`.ods` 等文件
- HTTP: 在 `.http`、`.rest` 文件中发送请求（集成自 [REST Client](https://github.com/Huachao/vscode-restclient)，并修复了本地请求的已知问题）；按 `Ctrl+Enter` / `⌘ Enter` 发送
- Java: 打开 `.class` 文件可反编译并查看源码

## 开发指南

### 环境要求

- [Node.js](https://nodejs.org/) 24（已验证的构建与打包环境）
- [VS Code](https://code.visualstudio.com/) 1.64+

### 快速开始

```bash
git clone https://github.com/Chihang03/vscode-office.git
cd vscode-office
npm ci
```

### 开发调试

**桌面端扩展**（完整功能）：

```bash
npm run dev
```

在 VS Code 中按 `F5`，或在「运行和调试」中选择 **Extension**。

**Web 端扩展**（浏览器中的 Markdown、HTML、YAML）：

```bash
npm run dev:web
```

在「运行和调试」中选择 **Extension (Web)**。

### 构建与打包

```bash
npm run build    # 生产构建
npm run package  # 生成 .vsix
```

## 使用数据

此社区 fork **不配置遥测接收端，也不发送扩展使用事件**。继承的 Application Insights 连接已移除。保留的 `kieran-document-studio.enableTelemetry` 设置默认为 `false`；本构建中将它设为 `true` 也不会开启上报。维护说明见 [docs/telemetry.md](docs/telemetry.md)。

主动执行 HTTP 请求、加载文档中的远程资源和使用 AI 功能，仍会访问各自配置的服务；这些功能与扩展使用遥测分开处理。

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
