# 从历史 Office fork 迁移

Kieran Document Studio 使用独立扩展 ID `chihang03.kieran-document-studio`。它会作为单独的扩展安装，不会升级或覆盖 `cweijan.vscode-office`。

## 配置与快捷键

旧配置不会自动写入新扩展，也不会修改上游扩展的设置。若希望沿用自定义值，在 VS Code 的设置 JSON 中复制所需条目并修改前缀：

```json
{
  "kieran-document-studio.editorTheme": "Auto",
  "kieran-document-studio.chromiumPath": "/path/to/chromium"
}
```

| 旧标识 | 新标识 |
| --- | --- |
| `vscode-office.<配置项>` | `kieran-document-studio.<配置项>` |
| `office.markdown.switch` | `kieranDocumentStudio.markdown.switch` |
| `office.html.preview` | `kieranDocumentStudio.html.preview` |
| `office.gitHistory.view` | `kieranDocumentStudio.gitHistory.view` |
| `office.gitHistory.viewFileHistory` | `kieranDocumentStudio.gitHistory.viewFileHistory` |
| `vscode-office.request` | `kieranDocumentStudio.request` |
| `office-material-icon-theme` | `kieran-document-studio-material-icons` |
| `.vscode-office-viewer.json` | `.kieran-document-studio-viewer.json` |

其他 `office.*` 命令使用 `kieranDocumentStudio.*` 前缀。自定义 HTTP 请求命令同样使用 `kieranDocumentStudio.*`。如有手写键盘绑定，请相应修改命令 ID。独立品牌版本不提供旧命令别名，避免与上游插件重复注册。

如果使用过用户目录下的 `.vscode-office-viewer.json`，可自行复制为 `.kieran-document-studio-viewer.json`。旧文件保留，扩展不会自动迁移或删除它。

## 编辑器关联与主题

历史 `workbench.editorAssociations` 中的 `cweijan.<编辑器>` 改为 `kieranDocumentStudio.<编辑器>`。例如：

```json
{
  "workbench.editorAssociations": {
    "*.md": "kieranDocumentStudio.markdownViewer",
    "*.xlsx": "kieranDocumentStudio.officeViewer"
  }
}
```

也可对文件选择“重新打开编辑器”，然后选择名称带有 Kieran Document Studio 的编辑器。两款扩展同时启用时，文件关联和默认快捷键仍可能重叠，请显式选择需要的编辑器和绑定。

使用本 fork 的图标主题时，选择 `Material Icons (Kieran Document Studio)`。颜色主题为 `One Dark Modern (Kieran Document Studio)` 和 `One Dark Modern Classic (Kieran Document Studio)`。

本版本不继承上游遥测连接，也不会执行旧版清理 VS Code 全局 WebStorage 的迁移操作。
