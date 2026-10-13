# PDF 标题大纲验证（0.1.2）

日期：2026-10-13。基于主线 0.1.1 提交 `0eb53af2d159f499f0e14757b241df1ce41bf0f2`。

## 行为

Markdown 一至六级标题生成 PDF 分层书签和 H1–H6 语义标签，点击书签可跳到对应页面及标题位置。正文继续不插入目录，[toc] 继续不渲染；文件名、日期页眉及当前页/总页数页脚保留。原 logo 不变。

使用 Chromium 原生大纲生成，保留浏览器计算的标题目标位置；已有大纲时设置 PDF PageMode 为 UseOutlines，提示查看器打开大纲侧栏。查看器或已有用户偏好可能覆盖自动展开行为。没有标题的文档不生成虚构书签。

## 验证

- 品牌检查、官方 vsce 构建与 0.1.2 打包通过。
- 13 项回归测试通过，包括正文目录抑制、书签位置及语义树保留、无标题文档处理和原有保存/失败流程。
- 真实 Chrome 生成两页 PDF，核对 10 个标题书签的一至六级层次、同名标题和第 2 页目标；代码块中的标题文本不产生书签。
- 用插件自带 PDF.js 查看器在 Chrome 中展开大纲，点击“本地图片”实际跳到第 2 页，截图和结果记录保存在 outputs。该验证使用与插件宿主一致的资源地址模板替换，没有替代实际 VS Code 宿主的完整端到端测试。
- PDF.js 在渲染普通网页链接注释时出现现有兼容性警告 `linkService.addLinkAttributes is not a function`；大纲显示及书签点击成功。本次未调整查看器的链接注释实现。
- 最终安装包从只包含 PDF 改动的临时副本构建，避免混入工作区同时出现的其他修改。

## 本地交付状态

源码修改位于 `feat/pdf-heading-outline`，尚未提交或推送，未创建 PR、未发布 Marketplace、未修改已有安装。

- 安装包：`../outputs/kieran-document-studio-0.1.2.vsix`
- 示例 PDF：`../outputs/studio-pdf-outline-sample-0.1.2.pdf`
- 大纲截图：`../outputs/studio-pdf-outline-viewer-0.1.2.png`
- 查看器验证：`../outputs/studio-pdf-outline-viewer-0.1.2.json`
