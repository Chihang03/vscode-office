# 0.1.12 2026-11-24

- 修复关闭 Git 历史“导出开发日志”弹窗后主界面黑屏的问题：为 Webview 消息桥 `handler` 补齐 `off()` 取消监听方法，避免 React `useEffect` 清理阶段抛出异常导致组件树卸载。
- 优化导出弹窗关闭与切换仓库时的文件统计加载状态清理逻辑，避免中途关闭后再次打开停留在加载中状态。

# 0.1.11 2026-11-24

- 修复 Windows 下导出 Git 开发日志时浏览器启动失败报错 `Failed to launch the browser process: Code: 0` 的问题：
  - 调整 Windows 浏览器探测顺序，优先使用 Google Chrome / Brave，再回退到 64 位与 32 位 Microsoft Edge（同步改善 Markdown 导出 PDF 的浏览器探测）。
  - 为每次启动分配独立临时配置目录 `userDataDir`，清理 `ELECTRON_RUN_AS_NODE` 环境变量，并附加 `--disable-features=msEdgeStartupBoost,msEdgeOnRamp`、`--disable-background-mode`、`--disable-gpu` 等参数避免与 Edge 后台进程发生单例接管退出。
  - 增加多策略启动重试（默认 headless、`headless: 'shell'`、Windows 下忽略 `--disable-extensions`）及遍历多浏览器候选的兜底逻辑；若 Puppeteer 调试通道仍被环境拦截，自动回退至浏览器原生无头 CLI（`--print-to-pdf` / `--screenshot`）完成导出。
  - 增强 Windows 临时目录清理重试（`maxRetries` + `try/catch`），避免文件短暂占用导致导出结果误报失败，并补充明确的中文错误提示。

# 0.1.10 2026-11-24

- 修复 Git 开发日志“分支图快照”导出多页 PDF 时的排版错位问题：将左右分栏的整张超长 SVG 改为原生分页表格（`<table>`）与按行精确裁剪的 `28px` SVG 切片，彻底消除首页空白及跨页后“左图右文”前后分离的现象。
- 支持分支图快照导出 PDF 时在每一页顶部自动重复表头（`图表 / 信息 / 作者 / 日期 / 哈希`），并保证分页断点落在整行之间。
- 修复超长分支或标签名称徽章在固定行高内折行被削顶的问题，增加不换行与超出省略样式；优化打印模式下的页面白底表现。

# 0.1.9 2026-11-23

- 新增 Git 历史“导出开发日志”功能：在顶部工具栏提供二级样式菜单（并在多选提交操作栏提供直达入口），内置三种视觉模板——**卡片时间线**（含统计卡片与每日活跃柱状图）、**正式分页报告**（A4 排版、作者贡献表与提交类型分组）、**分支图快照**（保留分支拓扑连线、标签与提交表格）。
- 新增导出配置与实时预览工作台，支持按当前视图、已选提交、最近 7 天、最近 30 天或自定义日期筛选，支持开关统计概览、排除合并提交、展开提交正文、显示文件与代码行增删统计、按提交类型分组及切换浅色／暗色主题。
- 支持一键导出为高清 2x **PNG 图片**、带页眉页脚与页码的 **PDF 文档**（基于本机 Chromium / Chrome / Edge 渲染）以及零依赖 **Markdown** 文档，导出完成后可直接从通知打开文件。

# 0.1.8 2026-11-23

- 全面清理并汉化 Git 历史视图与扩展宿主端硬编码英文，统一接入现有国际化（i18n）体系并在非中文环境下保留英文回退。
- 汉化顶部工具栏搜索框、仓库／分支／作者筛选下拉框、操作按钮悬浮提示及主题切换提示。
- 汉化提交表格表头（图表、信息、日期、作者、哈希）、当前检出提交提示、储藏标签、底部提交计数与文件历史横幅；相对提交时间改为跟随当前语言格式化。
- 汉化提交详情弹窗、文件变更列表与操作按钮、提交历史查找挂件、批量选择操作栏、仓库与扩展设置面板及远程仓库添加／编辑表单。
- 汉化右键菜单与操作确认对话框中的全部硬编码文案（包括检出、拣选、还原、合并、重置、创建分支、添加标签与批量操作说明）。
- 汉化 VS Code 命令面板与设置中的 Git 历史命令、配置描述、面板标题、未提交更改条目、差异对比工作区标题及快速同步交互提示。

# 0.1.7 2026-10-19

本版补记并正式汇总 `22af6d1d`（2026-10-16，Mermaid 可视化编辑）与 `6c3ba3a8`（2026-10-18，WAV 分析及参数记忆）。这两次提交当时仍沿用 `0.1.6`，且未同步更新日志；这里按本次实际交付版本记录。

- 新增 WAV 音频分析面板，直接读取未压缩 PCM／IEEE 浮点原始采样，提供 FFT 频谱、声谱图与调制频谱，支持单声道查看和左右声道对比。
- 支持选择 FFT 点数、频率范围、线性／对数坐标，以及 900–1,100 Hz 载波快捷范围；频谱与选区联动，声谱图跟随波形缩放和平移，并支持点击定位与拖动选区。
- 调制频谱在所选频段提取希尔伯特包络，提供 0–120 Hz 视图和可配置的参考频率，便于检查 37 Hz、47 Hz 等调幅刺激。
- 分析面板默认收起，展开后才启动后台计算；支持取消、重新计算与收起时停止任务，当前预览内缓存最近三组分析结果。
- 自动记住 FFT 点数、声道、频率范围、坐标和调制参考频率，换文件或重启后恢复；针对单声道和较低采样率适配不兼容参数，初始适配不会覆盖保存的偏好。
- 补齐简体／繁体中文分析界面、幅度单位和频点间隔说明，改善窄窗口刻度与参考线标签布局；区间频谱最多取 64 个窗口，声谱图最多取 160 个窗口，包络分析最多取起始 8 秒或 524,288 点。
- 新增 Markdown Mermaid 流程图的可视化编辑功能。
- 统一使用 `kieran-document-studio-<version>.vsix` 命名，所有安装包输出到工作区 `outputs/vsix/`，截图与测试记录另存同名版本目录；取消功能后缀，并在 AGENTS.md 中明确版本递增与更新日志要求。
- 核对独立维护以来的提交与本地安装包，补记 0.1.0 的焦点修复和品牌调整，并说明 0.1.4 的版本提交缺口。

# 0.1.6 2026-10-14

- Add offline editing of .drawio, .dio, .drawio.svg and .drawio.png using the pinned draw.io 32.4.1 engine and an independent VS Code adapter.
- Preserve editable metadata in SVG/PNG round trips and exports; integrate text dirty state, undo/redo, custom PNG backups and native saves.
- Synchronize external text changes, reject stale writes, and support read-only diagram preview/export.
- Add New Diagram/Open Diagram commands, source notices, integrity hashes and focused regression tests.
- Require VS Code 1.95+ for the bundled engine's browser runtime; retain existing branding, logo, audio, image and PDF functionality.

# 0.1.5 2026-10-14

- Add a read-only audio viewer with per-channel waveform, time ruler, moving playhead, click-to-seek, zoom, pan and overview navigation.
- Add selection-based A–B looping, playback speed, volume, mute and workspace playback-position restoration without autoplay.
- Stream PCM/IEEE float WAV waveform processing in an inline worker, preserve source metadata, and cache bounded peak envelopes by file version.
- Use available browser decoders for other audio formats with size checks and clear unsupported/truncated-file messages; retain native playback when waveform processing is cancelled or unavailable.
- Include the pending image zoom/pan fix from 0.1.4 and preserve the current independent brand and logo.

# 0.1.4 2026-10-14

历史记录补充：保留的本地安装包内部版本为 `0.1.4`，但 Git 中没有独立的 `0.1.4` 版本提交；以下图片改动随后随 `cd16e0db` 一并提交到 `0.1.5`。

- Pan zoomed images by dragging, with bounded movement and grab/grabbing cursors.
- Zoom around the pointer; double-click or use Fit to restore the centered view.
- Preserve Browse wheel navigation and arrow/thumbnail navigation; reset the view on image changes.
- Restrict zoom events to the active image viewport and avoid conflicting carousel swipes.

# 0.1.3 2026-10-13

- Combine PDF heading navigation and first-view table column fitting in one release.
- Generate nested PDF bookmarks and semantic heading tags from Markdown headings without inserting a visible table of contents.
- Preserve exact heading destinations, filename/date headers, page-number footers, and the current product logo.
- Keep CSV/TSV/Excel/ODS fitting limited to each worksheet's first display, preserving later manual widths and clean document state.

# 0.1.2 2026-10-13

- Fit columns when the current worksheet is first displayed in CSV, TSV, Excel, and ODS viewers. Defer other worksheets until first activation, including restored selections.
- Treat initial fitting as display layout: do not mark the file dirty or add an undo entry. Manual fitting remains an editable action.
- Preserve manual column resizing while editing and switching worksheets.

# 0.1.1 2026-10-12

- Keep the independent extension identity, current logo, source notices, and branding checks from main.
- Add Markdown PDF export to the command palette, editor toolbar, and editor/file context menus.
- Synchronize and save edited content before export, allow destination selection, and report export errors.
- Print the source filename and local export date in the header and current/total page numbers in the footer.
- Omit generated tables of contents and PDF bookmarks without modifying source TOC directives.
- Wait for diagrams and fonts before rendering; close the browser and clean temporary files after failure.
- Lock dependencies and run PDF regression tests in CI.

# Kieran Document Studio

## 0.1.0 — independent community fork

- Use independent publisher `chihang03` and extension ID `chihang03.kieran-document-studio`.
- Introduce an original product icon and explicit maintainer/upstream attribution.
- Isolate command, custom editor, configuration and theme namespaces; see `docs/migration.md`.
- Remove inherited author/sponsorship claims and the upstream telemetry connection.
- Remove the inherited migration that deleted shared VS Code WebStorage.
- Retain upstream MIT copyright, source history and third-party notices.
- 历史补记：`246732bf`（2026-10-11）修复关闭“关于”面板后编辑器焦点恢复不可用的问题。
- 历史补记：`cddf638d`（2026-10-11）补齐 Webview 标题、Git 历史界面及主题中的独立品牌信息。

## 独立品牌建立前的开发分支补记

以下记录来自 `feat/markdown-pdf-export`。本次核对（2026-10-19）时，这些提交不在当前分支的提交链中；版本号是该开发分支当时的内部版本，不作为 Kieran Document Studio 的正式版本序列。

- `4.2.1`，2026-10-10，`632688fe`：新增 Markdown PDF 导出并初始化当时的开发 fork；原提交未更新日志。
- `4.2.2`，2026-10-10，`2ba7250c`：新增 PDF 页眉、页码并移除自动目录；原提交未更新日志。
- `4.2.2`，2026-10-10，`3c85fce5`：在 PDF 集成测试前构建导出模板，属于该开发版本的 CI 调整。
- 另保留一份内部版本为 `4.2.3` 的本地安装包，但所核对的分支历史中没有对应版本提交；该包作为历史构建归档保留。

## Upstream history (retained)

The entries below describe the inherited Office Viewer project. Their versions are not Kieran Document Studio releases.

---

# Change log

# 4.2.0 2026-8-16

Markdown Editor:

- Support configuring automatic focus restoration.
- Reduce redundant focus restoration when switching tabs.
- Fix Shift+Enter not working in IR mode.
- Fix Markmap and heading anchor jumps in IR mode.

PDF:

- Update PDF.js to v3.1.
- Remove the extra green indicator on the bookmark sidebar.

XMind:

- Fix inability to drag the canvas.

Git History:

- Improve reset button hover color.
- Improve toolbar button placement.

# 4.1.9 2026-8-13

Markdown Editor:

- Support rendering workspace images.
- Support pasting images to workspace paths.
- Support Markmap diagrams with interactive features.
- Support WikiLink graph.
- Fix overlapping alert text in IR mode.
- Fix input issues after leaving the math formula editor.

Excel:

- Support opening empty XLSX files.

XMind:

- Support editing XMind files.

SVG:

- Support customizing the preview overlay.
- Use HTML syntax to support inline CSS highlighting.

Git History:

- Show details for stash and uncommitted changes.

Editor:

- Change dirty indicator to asterisk.

# 4.1.8 2026-7-28

Excel:

- Add insert image support.
- Add image crop tools.
- Add pivot table read/write support.
- Add select-all-cells support.
- Add advanced replace options.
- Improve XLSX loading performance.
- Improve image selection and dragging behavior.
- Fix inaccurate image drag anchor positioning.
- Hide the theme toggle while loading.

Markdown Editor:

- Fix link and image edit popover layout issues.
- Align frontmatter property key icons.

PDF:

- Improve sidebar styling.

# 4.1.7 2026-7-24

Markdown Editor:

- Support hard line breaks (`Shift+Enter`).
- Support opening PlantUML diagrams in the browser.
- Update Mermaid toolbar color scheme.
- Update Edit in VS Code icon color.

Excel:

- Add auto-fit columns action.
- Update toolbar VS Code icons.
- Polish sheet tab interaction area (WPS-style navigation, sheet list menu, and active tab scrolling).
- Fix:
  - Tolerate unsupported formats and formulas.
  - Fix inaccurate cell positioning after scrolling.
  - Fix workbook loading failure caused by expanded data validation rules.
  - Fix merged cell region recognition for the default selected cell.
  - Fix CSV loading failure when the first row is empty.

PDF:

- Add PDF Pro tools and polish the tools dialog.

Git History:

- Improve details dialog positioning.

# 4.1.6 2026-7-20

Markdown Editor:

- Focus the find input after clicking the find button.
- Fix anchor and footnote jump failure in documents.

Excel:

- Add formula bar.
- Improve VS Code theme compatibility.
- Add an Edit in VS Code action to the CSV editor toolbar.
- Add filter changes to history and increase zoom debounce delay.
- Fix:
  - Fix inability to save edited empty CSV files.
  - Sync clipboard highlight when switching sheets.
  - Prevent image selection when selecting a range.
  - Prevent images from appearing across all sheets.

Diff:

- Skip CSV and DOCX files in diff view.

# 4.1.5 2026-7-8

Fix:

- Fix unexpected file reload on edit.
- Prevent Zip Slip path traversal in archive extraction(Reported by Mykhailo Kholiev).

Git History:

- Improve git history view UI.
- Change date format to yyyy-MM-dd.
- Support more remote URL formats.

Markdown Editor:

New:

- Add Shift+Tab support.
- Add typewriter mode support.
- Add new line button for quick row insertion.
- Support quick drag to resize images(Pro Feature).

Update:

- Improve large file editing performance.
- Add replace feature to find component.
- IR mode: support block drag-and-drop and table enhancements.
- Beautify context menu and settings modal.
- Remove automatic double quote completion.
- Remove default 400px code block height limit.

Fix:

- Fix failure to edit tags and wikilinks normally.
- Fix extra blank line left after deleting sublist
- Fix settings modal closing when deleting prompt or model.

Excel:

Update:

- Copy cells with HTML formatting.
- Support zoom adjustment via scroll wheel.
- Preserve formatting when pasting from Excel.
- Support editable image drag and resize.
- Support cell selection in config function.
- Improve user interaction and context menu appearance.
- Change page scrolling from cell-based to pixel-based.

Fix:

- Fix find component focus accuracy.
- Fix vertical alignment display error.
- Fix cell text overflow, editor overlay, and row height.
- Fix cell interaction and descending sort after sorting.

# 4.1.3-4 2026-7-3

Fix:

- Fix SVG loading failure.
- Fix PPTX loading failure.

# 4.1.2 2026-7-3

Markdown Editor:

- Improve AI review panel.
- Add quick action presets for AI Polish.
- Add output language selection for AI Polish.

Fix:

- Fix math formulas and diagrams (Mermaid, PlantUML) not rendering correctly after code block lazy-loading optimization.

# 4.1.1 2026-7-3

Markdown Editor:

- Add code search support within code blocks.
- Improve editor performance when handling multiple code blocks.

Export:

- Move PDF export margin inside the content container.
- Upgrade html-to-docx for improved DOCX export quality.
- Dynamically load export dependencies (HTML, DOCX, PDF) to reduce extension size.

Git History:

- Add warning echo for Git operations.
- Fix graph being incorrectly dimmed.
- Align author filter options and simplify filtered graph.

Update:

- Improve view rendering performance.
- Replace cheerio with node-html-parser.
- Dynamically load Mermaid and Puppeteer to reduce extension size.

Fix:

- Resolve inline HTML rendering issue.
- Resolve file loading failure on Windows virtual space.

# 4.1.0 2026-7-1

New: Add Parquet file format support.

Markdown Editor:

- Improve visual design.
- Update keyboard shortcuts.
- Support code block font configuration.
- Improve light/dark mode switching logic.
- Fix failure to open relative path files in IR mode.
- Support font size adjustment via scroll wheel in the editor.

Pro:

- Introduce Pro license activation.
- Remove Sponsor banner after Pro activation.
- Support custom font color and background color editing.
- Support adjusting image width and height in the Markdown editor.
- Support beautiful PDF / HTML / DOCX export with theme, font, and font-size options.

Git History:

- Improve visual design.
- Adjust Git branch colors for better visibility in light mode.
- Gray out non-current commits while loading Git history view.
- Fix color inconsistency between graph lines and branches in Git history view.

# 4.0.9 2026-6-29

Update:

- Restore missing HTML viewer previewer registration.
- Fix outline loading failure caused by special headings (code blocks, line breaks).
- Improve file loading performance by streaming via webview URI instead of message buffer transfer.

# 4.0.8 2026-6-29

Markdown editor:

Update:

- Add image preview.
- Beautify CodeMirror toolbar.
- Disable latex syntax validation.
- Remember last selected theme preference.
- Sync settings to other editors after modification.
- Support expandable code blocks with configurable height.

Git History:

- Improve Git view and Git history view styling.
- Support double-click to quick push in Git view.
- Git history view supports pull and batch operations.

Fix:

- Support saving links with spaces.
- Fix class file decompilation failure.
- Fix Wikilinks in remote environment.
- Preserve bold text color in light theme.
- Prevent file cache generation after each view.
- Fix relative links and images in remote environment.
- Fix markdown editor loading issue for Russian locale.
- Fix the missing margin for the first child element at the top of the page.

# 4.0.7 2026-6-26

New:

- Support editing Vditor configuration via a configuration file.
- Markdown editor supports remote and web workspaces (vscode-vfs, vscode-remote).

Update:

- Beautify alert color.
- Improve PDF loading performance.
- Improve Git history view styling.
- Improve TIFF/HEIC loading performance.
- Change the default Excel font size to 11.
- Remove Git history caching for more accurate data.

Markdown:

- Add AI polish usage tip in settings panel.
- Fix CodeMirror font not syncing with typography settings.
- Fix pasted math formula blocks being converted into code blocks.

Fix:

- Fix incorrect read-only mode detection.
- Fix remote URL order in Git view with multiple repositories.

# 4.0.6 2026-6-26

New:

- Full support for Excel.
- Support editing DOCX files.
- Support the web version of VS Code.

Markdown:

- Support Wikilinks.
- Support AI-powered polishing.
- Support configuring editor typography.
- Support previewing and editing inline HTML.
- Support highlighting and autocompletion for latex formulas.

# 4.0.5 2026-6-23

Important: **Refactor Markdown editor**: beautified UI with modernized toolbar, in-page search (Ctrl/Cmd+F), and real-time code block editing

Other:

- Update Material Icons
- Add Kusto (KQL) syntax highlighting
- Beautify Git history view: refreshed styling and a commit details panel
- Support batch Git operations: push branches, add tags, and delete tags across multiple remotes in one action

# 4.0.4 2026-6-19

New:

- Add Kotlin syntax highlighting
- Add Nginx conf syntax highlighting
- Add anonymous usage telemetry (respects VS Code global telemetry settings)

Update:

- Beautify the SVG and PDF view
- Hide sponsor banner in Excel view while loading
- Refresh Git history after deleting filtered branches

# 4.0.3 2026-6-18

Important:

- Redesign the One Dark Modern theme
- Add Git history management feature

New:

- Add SVG editor
- Add support for ODS format
- Add syntax highlighting for TOML
- Add YAML outline and anchor navigation support

Update:

- Add dark mode toggle to PDF viewer
- Update markdown editor default theme
- Add icons for Parquet, SQLite, and DuckDB
- Change the default PPTX view to light mode
- Support quick switch color in markdown editor

# 4.0.2 2026-6-15

- Integrate HTTP client for `.http` and `.rest` files
- Support XMind, PSD, ICNS, HEIC and TIFF formats

# 4.0.1 2026-6-14

- Better zip viewer
- Fix excel save tip gone

# 4.0.0 2026-6-14

- Support pptx and epub files
- Support 7zip and tar.gz archives
- Better support for docx, excel, pdf and archives

# 3.5.7 2026-6-12

- Fixed paste image failed in markdown editor

# 3.5.6 2026-6-10

- Update puppeteer-core version
- Beautify zip,font,image and markdown view
- Fix command 'office.markdown.paste' hijacks ctrl/cmd+v

# 3.5.5 2026-6-8

- Update mermaid version
- Integrate Vditor resources
- Fix Excel cell shortcut keys not working on MacOS

# 3.5.4 2025-4-28

- Support edit excel and csv file.

# 3.5.3 2025-4-17

- Support view rar file.

# 3.5.2 2025-4-10

- Compatible with rest client.

# 3.5.1 2025-4-7

- Better support for zip viewer.
- Update extension name and icon.
- Support export markdown with Mermaid.

# 3.5.0 2025-1-14

- Remove markdown editor border.

# 3.4.8 2024-12-14

- Modify the font of the markdown editor.

# 3.4.6 2024-12-13

- Add more markdown editor theme.
- Support refresh for zip viewer.

# 3.4.2 2024-9-28

- Fixed "Edit In VS Code" shortcut not working.
- Fixed copying content failure in preview mode.

# 3.3.4 2024-6-4

- Better csv and zip support.

# 3.3.3 2024-5-6

- Support edit svg in VS Code.
- Fix shortcut key conflict with Copilot.
- Support display font item name and search font item.

# 3.3.2 2024-4-6

- Support sort zip items.

# 3.3.1 2024-3-30

- Update font and pdf viewer.

# 3.3.0 2024-3-29

- Rewrite the UI front end using React.

# 3.2.5 2024-3-8

- Add shortcut document.
- Update editor switch icon.
- Fix load chinese zip entry failed.

# 3.2.4 2024-3-5

New:

- Support view woff2 font.
- Support modifying editor theme individually.

Markdown

- Follow vscode editor font size.
- Add button to quick switch markdown editor.

Other:

- Support edit in vscode for csv.
- Support edit in vscode for svg.
- Only use image viewer for svg.

# 3.2.0 2024-3-4

- Use vscode default editor when diffing.
- Fix cannot save outline state for macOS.
- Fix cannot find chromium path on macOS.

# 3.1.7 2023-9-32

- Fix export markdown to docx fail.

# 3.1.5 2023-5-18

- Support view apk file.

# 3.1.4 2023-5-4

- Support view zip file.

# 3.1.2 2023-4-25

- Change inactive tab foreground color.

# 3.1.1 2023-4-24

- Update peek view colors.
- Remove semantic highlighting.

# 3.1.0 2023-4-13

- Better theme colors.
- Markdown:
  - Katex compatible wrong formula.
  - Load the chart with a white background.
  - Support for rendering latex formulas in an offline environment.

# 3.0.4 2023-4-11

- Modify the background color of the theme.

# 3.0.2 2023-4-5

- Update extension icon.

# 3.0.1 2023-4-3

- Fix git view cannot view pictures.
- Support for reloading workspace docx after file changes.
- PDF:
  - Fixed sometimes opening PDF failed.
  - Do not display the sidebar on small screens.
  - Support export markdown to pdf without outline.

# 3.0.0 2023-3-29

- Better docx rendering.

# 2.9.6 2023-3-7

- Reduce the size of the excel save notice.
- Support resizing the view through ctrl/meta with mouse scrolling.
- Word:

  - Fix cannot display images.
  - Fix pager jumping incorrectly.
  - Reduce pagination navigator size.
- Markdown:

  - Support hide toolbar.
  - Fix extension activation failure when rest client exists.
  - Support open hyperlinks via meta or middle mouse button.

# 2.9.5 2023-1-12

- 更新主题的editorInlayHint颜色.
- Markdown:
  - 代码块预览增加行号显示.
  - 支持配置代码块颜色样式.
  - 粘贴图片路径增加workspaceDir变量.
  - 修复无法导出PDF.
  - 修复无法显示绝对路径的图片.

# 2.9.4 2022-12-20

- 调整代码块颜色.
- 支持设置导出pdf的chromium路径.

# 2.9.3 2022-12-10

- 修复Pdf部分字体无法加载.
- QuickItem和菜单的border颜色优化.

# 2.9.2 2022-12-6

- 修复表格工具栏消失.
- 保存xlsx时增加确认框.
- 导出Html和docx时不生成目录.
- 修复图片过多时无法显示图片文件名.

# 2.9.1 2022-11-23

- 调整markdown编辑器小屏下的大纲宽度
- Markdown转换的Pdf调整页面边距.

# 2.9.0 2022-11-9

- Speed up extension activation.

# 2.8.1 2022-10-29

- Fix preview html unable to load images.
- Markdown:
  - Support export to docx.
  - Fix hr can not display on dark theme.
  - Edit math formulas using different background colors.
  - Fix export pdf not rendering math formulas that start or end with spaces.

# 2.8.0 2022-10-24

- Change markdown editor default language to english.
- Supporting change of language for editor [en_US, ja_JP, ko_KR, ru_RU, zh_CN, zh_TW]

# 2.7.9 2022-10-23

- 修复小屏下工具栏丢失.

# 2.7.8 2022-10-19

- Markdown:
  - 修复导出的pdf数学公式显示异常.
  - 优化自带主题的markdown显示效果.
- Pdf:
  - 优先显示大纲视图.
  - 美化部分视觉效果.
  - 修复只能显示二级大纲.

# 2.7.7 2022-10-18

- markdown:
  - 升级katex版本.
  - 固定工具栏位置.
  - 记住文件最后的编辑位置.
  - 修复切换不同的markdown总数没有更新.
  - 修复小屏下工具栏样式异常, 以及无法显示大纲.

# 2.7.5 2022-10-12

- 优化大纲切换的焦点.

# 2.7.4 2022-10-11

- markdown
  - 修复字数没有实时更新.
  - 修复diff视图无法显示图片.
  - 修复部分情况下在外部编辑后没有实时更新.
- 修复excel无法保存更新.
- 图片浏览器支持通过ctrl+滑动放大图片.

# 2.7.3 2022-10-5

- 完善焦点聚焦逻辑.
- 支持ctrl+shift+v粘贴为纯文本.
- 增加自动清理webview缓存.
- Markdown:

  - 自动识别粘贴的图片类型.
  - 修复粘贴文本后选中的文本还在.
- 预览Html支持解析本地js文件.

# 2.7.2 2022-9-15

- 移除图片中的空格.
- 修复latex公式显示不全.

# 2.7.1 2022-9-5

- 优化编辑器焦点恢复功能.

# 2.7.0 2022-9-2

- 升级vditor版本.
- 增加设置编辑器焦点的延迟.
- 美化右键菜单样式, 点击其他地方后隐藏菜单.

# 2.6.9 2022-8-29

- 修复代码块背景颜色异常.

# 2.6.8 2022-8-28

- Markdown: 修复显示绝对路径图片的设置无效.
- Xlsx:
  - 支持查看xlsm文件.
  - 加快excel文件打开速度.
  - 修复xlsx超过26的列无法显示.

# 2.6.7 2022-8-28

- Markdown:
  - 修复分割线无法显示.
  - 移除单引号和美元符号的补全.
  - 导出的pdf目录序号修改样式为圆圈.
  - 支持关闭代码预览, 修改代码块背景颜色.
- 修复查看docx文件时, 如果页面数量页面错乱.

# 2.6.1 2022-6-19

- 修复在Vditor无法打开相对路径的markdown.

# 2.6.0 2022-6-13

- 对主题的自适应功能进行优化.
- 修复编辑markdown时输出了无关日志.

# 2.5.8 2022-6-7

- 支持打开dotx文件
- markdown编辑器支持打开图片超链接
- 更新超链接颜色

# 2.5.7 2022-6-7

- 优化粘贴图片的逻辑
- 优化自动主题颜色的边框颜色
- 保存后更新字数总数
- 修改默认代码主题

# 2.5.5 2022-5-28

- 支持配置markdown粘贴图片的路径
- 更新vditor版本

# 2.5.1 2021-12-29

- 增加稳定性, 修复图片有时保存失败
- Support save outline open state.

# 2.5.0 2021-12-27

- Update markdown editor:
  - To open a hyperlink, need to hold down ctrl.
  - Support chose image from toolbar.
  - Update editor when external update.
  - Open source code editor as beside.
- Fix puml editor not trigger save.
- Fix html preview not support untitle document.

# 2.4.2 2021-12-4

- Fix markdown editor cannot cut, loss focus.

# 2.4.1 2021-9-9

- Rollback docx support.
- Fix http auto-complection fail.
- Reduce markdown editor cache usage.

# 2.4.0 2021-8-3

- Better http client support.
- Fix markdown editor cannot save.

# 2.2.2 2021-6-19

- Speed up picture pasting

# 2.2.0 2021-6-2

- Not trigger vscode hotkey when match markdown hotkey.
- Support immediately preservation.

# 2.1.1 2021-5-27

- Change vditor mode from ir to wysiwyg.
- Fix markdown cannot type tab.
- Reduce markdown editor padding.

# 2.0.0+

- Support ods file.
- Remove top button of word document.
- Remove markdown style.
- Support inline markdown.
- Support export to html.
- Markdown support auto quote.
- Change viewer name as editor.
- Change default markdown editor as vditor.

# 1.9.1 2021-1-18

- Fix cannot view big xmind.
- Support follow theme with docx viewer.
- Image viewer support show pixel.

# 1.9.0 2020-12-30

- Support view csv file with utf8 encoding.

## 1.8.9 2020-12-21

- Update java decompiler version, change priority as option.
- Markdown editor support paster as plain text.

## 1.8.1 2020-11-24

- Change export markdown pdf chinese font to 'Song  style'
- Export markdown auto add bookmarks.
- Update markdown list style.

## 1.8.0 2020-11-24

- Support play flash swf animation.

## 1.7.10 2020-11-23

- Support open link from markdown.

## 1.7.9 2020-11-19

- support paste image file in markdown editor.

## 1.7.7 2020-11-17

- Update status bar when open markdown editor.

## 1.7.5 2020-11-11

- Add java class decompiler.

## 1.7.1 2020-11-3

- Support generate outline for pdf.

## 1.7.0 2020-11-2

- Support export markdwon to pdf.
- Support edit xlsx、xls、csv.

## 1.6.0 2020-10-19

- Add font viewer.
- Adjust markdown style and fix save fail bug.

## 1.5.0 2020-10-16

- Enhance Image viewer.

## 1.4.3 2020-10-12

- Fix paste fail in terminal.
- Using hyperMD as default markdown editor.

## 1.4.0 2020-10-9

- Integrate stackedit to edit markdown.
- Add csv support.

## 1.3.0 2020-10-8

- Add plantuml support.
- Adjust svg css.

## 1.2.0 2020-10-8

- Add pdf support.
- Add xmind support.

## 1.1.0 2020-10-8

- Add epub support.
- Add svg support.
- Add photoshow support.
- Add windows reg support.
- Add paginition to docx view..
