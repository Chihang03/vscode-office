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

CSV、TSV、Excel 和 ODS 表格打开后，会按内容自动适配当前工作表的列宽；其他工作表在第一次切换到它时才执行，恢复上次查看的工作表也遵循此规则，不会因此将文件标记为已修改。之后手动调整的列宽在编辑和切换工作表时保留；仍可点击 AF 按钮再次适配。

## Git 历史

Kieran Document Studio 内置完整的 Git 历史工作区，让你无需离开 VS Code 即可浏览仓库。可从源代码管理视图、编辑器标题栏、编辑器右键菜单或文件资源管理器右键菜单打开。


## Markdown

集成 Markdown 所见即所得编辑器。

悬停在 Mermaid 图表上，点击 **可视化编辑图表**，可在画布中添加、删除和修改流程图节点与连线，切换形状、箭头、文字、颜色、线宽及布局方向。点击 **连接** 后依次选择两个节点，或从一个节点拖到另一个节点，即可建立连接。属性栏支持新建、重命名、删除子图分组和调整成员，删除分组会保留其中的节点。选择图形可定位源码，在源码中移动光标也可定位对应图形。

面板提供独立的草稿撤销／重做、源码编辑和实时预览；**应用** 将结果写回原来的标准 `mermaid` 代码块，随后可通过文档撤销恢复，**取消** 丢弃草稿。可视化操作覆盖 `flowchart` / `graph` 的常用节点、链式连线、分组及样式；复杂语法与其他图种继续使用源码编辑和预览。文字、形状、连线及样式修改尽量局部写回，分组成员调整会重组节点和连线声明，保留注释、配置和样式定义。布局由 Mermaid 自动计算。若原代码块已改变，会提示保留草稿并重新打开。

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

## 图形编辑（Draw.io 格式）

支持 `.drawio`、`.dio`、`.drawio.svg` 和 `.drawio.png`，可选择 **Kieran Document Studio 图形编辑器** 打开，或使用命令面板中的 **新建图形 / 打开图形**。内置 draw.io 32.4.1 离线内核，无需另装扩展；可以编辑形状、文字、连线和页面，通过保存按钮或 Ctrl/Cmd+S 保存。XML/SVG 使用 VS Code 文本文档的未保存标记与撤销重做；PNG 保留内嵌图形数据，并支持原生撤销重做和备份。导出的 SVG/PNG 也保留可继续编辑的图形数据。普通 SVG/PNG 仍使用原来的查看器。若同时安装其他 Draw.io 扩展，可通过 **重新打开编辑器的方式** 选择使用哪一个。

图形修改先保留在 VS Code 未保存缓冲区，不会每次修改都直接写入磁盘。外部 XML 更新会同步到画布；版本已过期的并发修改会被拒绝，并提示重新加载。Git 或只读来源可预览和导出。本次首版不包含云存储、插件、代码链接或 Live Share。离线内核需要较新的浏览器运行时，最低 VS Code 版本调整为 **1.95**。文件适配由 Kieran Dai 独立维护，内核及附带素材保留原始来源与许可，详见 [第三方说明](THIRD_PARTY_NOTICES.md)。

## 音频查看

打开音频文件，或选择 **重新打开编辑器的方式 → Kieran Document Studio 音频查看器**。音频为只读预览，点击播放后才开始播放。界面提供分声道波形、时间轴与播放线、点击定位、倍速、音量和静音控制。在波形上拖动选区后可开启 **A–B 循环**。滚轮或缩放按钮放大波形，切换到 **平移** 模式拖动（也可按住 Shift 拖动），下方总览可快速导航，**完整音轨** 恢复全貌。工作区会记住播放位置，波形按文件版本缓存。

PCM 和 IEEE 浮点 WAV 在本地 worker 中流式计算波形，采样率、声道数和位深直接来自文件头。MP3、FLAC、OGG/Opus、M4A/AAC、AIFF 和音频 WebM 依赖当前 VS Code 提供的解码器，具体支持情况随编码和平台变化，界面显示的是**解码采样率**。这些格式的波形计算限制为 32 MiB 编码数据，并进行保守的时长预检及 128 MiB 解码数据检查。无法生成波形或取消计算时，已支持的原生播放仍可使用。虚拟或远程文件限 16 MiB。波形最多显示八个声道；A–B 循环使用媒体播放时钟，适合试听，不用于采样点级剪辑。

展开 **音频分析** 可直接分析未压缩 PCM／IEEE 浮点 WAV 的原始采样：支持逐声道查看或声道 1、2 叠加比较，选择 FFT 点数、频率上下限及线性／对数坐标。FFT 频谱分析当前选区，无选区时使用波形可见范围；声谱图跟随波形缩放和平移，点击可定位播放，拖动可创建共用选区。**900–1,100 Hz** 快捷范围适合检查 1 kHz 调幅载波及边带。调制频谱对所选频段提取希尔伯特包络，显示 0–120 Hz，可输入 `37, 47` 等参考频率。

频谱采用汉宁窗和相干增益校正，以满幅正弦峰值为 0 dBFS；区间频谱最多平均 64 个均匀窗口。声谱图最多采用 160 个均匀窗口，跨度较大时可能存在未分析的窗口间隙，检查短暂事件请放大。调制频谱使用分析范围起始最多 8 秒或 524,288 点，两端各裁去最多 50 ms，去除包络直流后相对平均包络归一化；其 dB 参考不是 dBFS。界面显示实际时间范围、FFT 点间隔与窗口时长；点间隔不等于实际分辨能力。计算在本地后台线程中进行，可取消并重新计算；同一文件和参数的最近三次结果保留在当前预览内存中。结果反映文件内容，不能替代声学输出测量或 EEG／ASSR 验证。

分析参数（FFT 点数、声道、频率范围、坐标及调制参考频率）自动保存在当前 VS Code 配置文件的本地状态中，换文件和重启后继续使用；新预览始终默认收起，只有展开后才启动分析。单声道或较低采样率文件会适配不兼容的声道与频率范围，初始适配不会覆盖保存的偏好。

## 图片查看

在 **Zoom** 模式下，滚轮围绕鼠标位置缩放，按住鼠标左键拖动放大后的图片可查看边缘。双击图片或点击 **Fit** 恢复居中的适应窗口视图。**Browse** 模式下滚轮切换图片；箭头和缩略图也可切图，切图时会重置缩放和平移。

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
- [VS Code](https://code.visualstudio.com/) 1.95+

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
