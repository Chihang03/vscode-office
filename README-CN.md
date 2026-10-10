# Office Viewer (Chihang03)

本仓库是 [Chihang03 的开发分支](https://github.com/Chihang03/vscode-office)，基于 [cweijan/vscode-office](https://github.com/cweijan/vscode-office) 的 `main` 提交 `908258dafc827ce0475fe7671d414914fbd3867b`。保留原项目的 MIT 许可证及第三方声明。

本版本增加 Markdown 导出 PDF 的命令面板、编辑器工具栏、编辑器右键和文件资源管理器右键入口。打开或选中 `.md` / `.markdown` 文件，运行 **Office Viewer: 将 Markdown 导出为 PDF**，选择输出位置。导出前会等待编辑器内容同步并保存源文件，显示导出进度，成功后可点击“打开 PDF”。取消输出位置选择会停止导出。

PDF 导出需要扩展运行环境中的 Chrome、Edge 或 Chromium。自动检测失败时，设置 `vscode-office.chromiumPath` 为浏览器可执行文件路径。纯浏览器版 VS Code 不支持此功能；通过 SSH 或容器开发时，需要在远程环境安装浏览器。本地测试时请禁用上游 Office Viewer 扩展，本分支目前仍沿用其命令和编辑器 ID。


[English](README.md) | 简体中文 | [繁體中文](README-TW.md)

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

Office Viewer 内置完整的 Git 历史工作区，让你无需离开 VS Code 即可浏览仓库。可从源代码管理视图、编辑器标题栏、编辑器右键菜单或文件资源管理器右键菜单打开。

![1783342874748](image/README/1783342874748.png)

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

在编辑器中右键，可将 Markdown 导出为 PDF、DOCX 或 HTML。PDF 导出依赖 Chromium，可通过 `vscode-office.chromiumPath` 配置浏览器路径。

![导出 Markdown](image/README-CN/1685418034035.png)

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
- 图标主题: 内置 [Material Icon Theme](https://github.com/PKief/vscode-material-icon-theme) 部分图标，并提供 **Office Material Icon Theme** 与 **One Dark Modern** 配色主题
- Excel: 支持预览和保存 `.xlsx`、`.xls`、`.xlsm`、`.csv`、`.ods` 等文件
- HTTP: 在 `.http`、`.rest` 文件中发送请求（集成自 [REST Client](https://github.com/Huachao/vscode-restclient)，并修复了本地请求的已知问题）；按 `Ctrl+Enter` / `⌘ Enter` 发送
- Java: 打开 `.class` 文件可反编译并查看源码

## Sponsor

[![Database Client](https://doc.database-client.com/public/logo.png)](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-database-client2)

适用于 Visual Studio Code 的数据库客户端，支持 **MySQL/MariaDB、PostgreSQL、SQLite、Redis** 以及 **ElasticSearch** 等数据库的管理，且可作为一个 SSH 客户端，极大地提升您的生产力！[立刻安装](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-database-client2)。

## 开发指南

### 环境要求

- [Node.js](https://nodejs.org/) 22.12+
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

## 验证

```sh
npm run test:pdf         # 保存顺序、取消、失败提示、输出路径及临时文件清理
npm run build
npm run test:pdf:smoke   # 使用已安装浏览器生成 out/pdf-smoke/sample.pdf
npm run package         # 生成 VSIX，不发布到扩展市场
```

真实浏览器测试可通过 `OFFICE_PDF_CHROMIUM_PATH` 指定浏览器路径。生成后检查中文、表格、代码、公式、Mermaid 图及本地图片。Windows、Linux 及远程扩展环境还需要在对应主机验证。

## 使用数据

本分支关闭扩展遥测，并移除上游 Application Insights 连接配置。以后如需采集使用数据，应配置自己的服务，并在启用前更新说明。

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
