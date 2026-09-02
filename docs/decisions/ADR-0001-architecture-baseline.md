# ADR-0001：首版架构基线

- 状态：拟采用，待业务负责人确认关键约束后接受
- 日期：2026-08-12

## 背景

系统需同时服务 Windows 桌面和手机，处理库存与欠款等强一致业务；团队规模和运维能力预计有限，但需要未来可扩展和专业交接。

## 决策

采用 Tauri 2 + React 19 + TypeScript/Vite 统一 Windows/Android 客户端、Node.js 24 LTS + NestJS 模块化单体、PostgreSQL 18 单一正式账本、REST/OpenAPI 接口。客户端 SQLite 仅用于缓存和离线草稿；首版正式过账必须在线由服务端确认。部署以 Docker Compose 为基础，优先使用 HTTPS 和托管 PostgreSQL。

## 理由

- 一套 React/TypeScript 业务 UI 覆盖 Windows/Android，并保留 iOS/PWA 能力，降低界面与业务交接成本；
- 模块化单体利于数据库事务和小团队维护，避免微服务分布式复杂度；
- PostgreSQL 提供成熟事务、约束、索引与备份能力；
- OpenAPI 提供明确跨端契约并可生成客户端；
- 有限离线避免在首版引入高风险多主账本冲突。

## 后果

正面：客户端与服务端统一 TypeScript 主语言、部署较简单、账务一致性强、可测试。代价：客户端仍需认真处理桌面与手机布局；服务器不可用时不能正式过账；Tauri 的目标打印设备必须先做 PoC，且平台边界仍需少量 Rust 能力。

## 复审触发条件

- 明确要求长时间完全断网正式开单；
- 用户/门店规模或负载超过已验证容量；
- Tauri 对关键打印/硬件无法满足：Windows 外壳切换 Electron，保留 React UI；
- 出现可量化、长期独立扩容的模块边界。

复审必须新增 ADR，不直接改掉本记录。
