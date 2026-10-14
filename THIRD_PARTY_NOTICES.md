# 来源、版权与第三方组件

Kieran Document Studio（文档工作台）由 Kieran Dai（GitHub：Chihang03；发布者：chihang03）独立维护，是社区 fork。产品维护者与下列原作者、组件维护者之间不构成官方发行、赞助或背书关系。

## 上游项目

本项目基于 [cweijan/vscode-office](https://github.com/cweijan/vscode-office) 的 Office Viewer。原作者版权为 `Copyright (c) 2020 Weijan Chen`，原 MIT 许可证完整保留在 [LICENSE](LICENSE) 中，Git 历史中的原作者信息也予以保留。独立品牌和后续修改不改变上游代码的来源。

独立扩展 ID 为 `chihang03.kieran-document-studio`，版本从 0.1.0 起单独维护。历史版本 4.2.0 及其 `cweijan.vscode-office` 标识来自上游，不能据此把本 fork 识别为上游官方更新。

## 已识别的组件来源

| 组件 | 来源 | 许可证 / 随附文件 |
| --- | --- | --- |
| Vditor / 本仓库的定制 Markdown 编辑器 | [Vanessa219/vditor](https://github.com/Vanessa219/vditor)，继承上游 Office 项目中的定制版本 | MIT；[许可证](licenses/vditor-LICENSE.txt) |
| HTTP 请求功能 | [Huachao/vscode-restclient](https://github.com/Huachao/vscode-restclient)，继承上游集成代码 | MIT；[许可证](licenses/rest-client-LICENSE.txt) |
| Material Icon Theme 图标子集 | [PKief/vscode-material-icon-theme](https://github.com/PKief/vscode-material-icon-theme) | MIT；[许可证](licenses/material-icon-theme-LICENSE.txt) |
| SheetJS / XLSX | [SheetJS/sheetjs](https://github.com/SheetJS/sheetjs) | Apache-2.0；[随安装依赖提供的许可证](licenses/sheetjs-LICENSE.txt) |
| ExcelJS / `@cweijan/exceljs` | [exceljs/exceljs](https://github.com/exceljs/exceljs)，以及上游使用的 `@cweijan/exceljs` fork | MIT；[随安装依赖提供的许可证](licenses/exceljs-LICENSE.txt) |

PDF、DOCX、PPTX、EPUB、PSD、XMind、HEIC、Java 反编译等组件的项目链接见 README 的 Credits 部分。其原有代码署名与构建后保留的许可证注释继续适用；该表是已识别的主要来源，不是全部传递依赖的许可清单。

## 产品图标

`image/kieran-document-studio.png` 是为本 fork 新生成的紫色与琥珀色书页/书签图案，替代继承的产品图标。历史截图、上游产品图标和推广素材不进入本 fork 的 VSIX 包。

## Draw.io 格式兼容

使用 [jgraph/drawio](https://github.com/jgraph/drawio) 的官方前端内核，固定版本 **32.4.1**，提交 `9034053fba80a435e27d68d374bc564b83917ae9`。代码许可为 Apache-2.0，原许可证保存在 [drawio-LICENSE.txt](licenses/drawio-LICENSE.txt)。随附图标、形状及素材的条款与上游第三方说明保存在 [UPSTREAM-README.md](resource/drawio/UPSTREAM-README.md)，其中包含 Atlassian 产品生态相关的素材使用限制。文件校验值和适配修改列于 `resource/drawio/vendor.json`。

本项目自行实现 VS Code 文件适配、同步、保存及导出。参考 [hediet/vscode-drawio](https://github.com/hediet/vscode-drawio) 的文件格式支持范围和官方嵌入协议；该扩展的 GPL-3.0 实现没有被复制或打包。修改涉及入口 HTML、启动参数、内层页面启动时机，以适配 VS Code 资源加载机制；云集成、插件和上游开发源码不进入安装包。Kieran Document Studio 使用自身名称和图标，与 draw.io 和 hediet 不构成官方发行或背书关系。
