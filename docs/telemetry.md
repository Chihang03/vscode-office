# Kieran Document Studio 遥测状态

本 fork 的 `src/service/telemetryService.ts` 中连接字符串为空，不创建遥测 Reporter，也不发送扩展使用事件。继承的上游 Application Insights 连接已移除。

`kieran-document-studio.enableTelemetry` 默认为 `false`，仅作为保留配置。即使用户将它改为 `true`，当前构建仍因没有接收端而保持关闭。

`telemetry.json` 是继承的事件字段说明，不是有效连接配置，也不表示这些事件正在发送。

如果维护者未来接入自己管理的遥测服务，需要同时更新接收端归属、事件清单、隐私说明和用户选择机制。不要恢复继承的连接地址，也不要把上游服务描述成自己的服务。

## 验证

- `npm run check:identity` 检查连接字符串为空、默认配置关闭。
- 在当前构建中，即使将保留配置设为 `true`，Reporter 也不会初始化。
- VS Code 自身、其他扩展和用户主动调用的 HTTP / AI 服务具有各自的数据行为；本页只描述本扩展的使用遥测。
