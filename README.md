# 玉春 YC 农机 ERP

“玉春”（简称 **YC**）农机经营管理系统，面向个体农机商户管理商品、采购、销售、库存、应收、应付与资金流水。项目已进入正式模块开发阶段，商品、往来、仓库、权限、采购、销售、库存、应收、供应商付款和预付款已使用真实数据库。

## 项目目标

- 同时提供 Windows 桌面端和 Android/iOS 手机端，核心业务口径一致。
- 管理农机整机、农机配件、螺丝等多规格、多单位商品。
- 打通采购、入库、销售、出库、退货、收付款、客户欠款和我方欠款。
- 每一笔库存和欠款变化都能追溯到业务单据与操作人。
- 支持可靠备份、恢复、权限控制、操作审计和规范交接。

## 首版技术基线

- 客户端：Tauri 2 + React 19 + TypeScript + Vite（Windows、Android，保留 iOS 能力）
- 服务端：Node.js 24 LTS + NestJS，模块化单体
- 数据库：PostgreSQL 18；客户端受控缓存使用 SQLite
- 接口：REST + OpenAPI；金额使用十进制定点类型，禁止 JavaScript 浮点直接结算
- 部署：Docker Compose + HTTPS；已提供正式备份恢复、每日自动备份和第二存储副本，生产环境仍需配置离店/云端副本并定期恢复演练

版本号在真正创建代码工程时锁定到当日稳定补丁版；不得仅凭本文中的大版本号盲目安装。

## 文档导航

1. [项目章程](docs/00-project-charter.md)
2. [产品需求说明](docs/01-product-requirements.md)
3. [业务流程与账务规则](docs/02-business-processes.md)
4. [系统架构](docs/03-architecture.md)
5. [数据模型](docs/04-data-model.md)
6. [界面与体验规范](docs/05-ui-ux.md)
7. [UI 原型评审](docs/UI-PROTOTYPE.md)
8. [安全、审计与备份](docs/06-security-audit-backup.md)
9. [开发规范](docs/07-development-standards.md)
10. [测试与验收](docs/08-testing-acceptance.md)
11. [部署与运维](docs/09-deployment-operations.md)
12. [交接说明](docs/10-handover.md)
13. [实施路线图](docs/11-roadmap.md)
14. [AI 项目上下文](docs/ai/AI_CONTEXT.md)
15. [AI 任务模板](docs/ai/TASK_TEMPLATE.md)
16. [AI 审查清单](docs/ai/REVIEW_CHECKLIST.md)
17. [已知风险](docs/ai/KNOWN_RISKS.md)
18. [技术调研](docs/research/technology-options.md)
19. [门店快速销售流程调研](docs/research/erp-fast-sales-workflow.md)
20. [商品资料模块](docs/modules/catalog.md)
21. [客户与供应商模块](docs/modules/parties.md)
22. [仓库与库位模块](docs/modules/warehouses.md)
23. [身份认证与权限模块](docs/modules/identity.md)
24. [库存账本与期初库存模块](docs/modules/inventory.md)
25. [采购入库模块](docs/modules/purchasing.md)
26. [付款与应付模块](docs/modules/payables.md)
27. [销售出库与客户应收模块](docs/modules/sales.md)
28. [资金账户与账户转账模块](docs/modules/cash.md)
29. [真实经营看板](docs/modules/reporting.md)
30. [库存报损流程调研](docs/research/inventory-damage-workflow.md)
31. [库存调拨流程调研](docs/research/inventory-transfer-workflow.md)
32. [门店资料与系统参数模块](docs/modules/administration.md)
33. [数据备份与恢复模块](docs/modules/backup-recovery.md)
34. [PostgreSQL 备份与恢复方案调研](docs/research/postgresql-backup-recovery.md)

## 当前状态

已完成 PostgreSQL 开发环境、NestJS API、Prisma 数据模型及正式 React 客户端。商品、往来单位、仓库、权限、期初库存、库存账本、整仓库存盘点、库存报损、采购入库、采购退货、销售出库、销售退货、销售错单冲销、客户应收、客户收款反核销、客户预收款、供应商付款、指定应付核销、整单付款反核销、供应商预付款、后续抵扣、资金账户间转账和真实经营看板均已使用真实数据库。销售正式过账会扣减库存并固化成本和毛利：散客现结增加资金账户，只有客户赊账才形成客户应收。真实经营看板已经替换首页演示数字；“往来欠款”旧展示组件仍不得当作正式账目，真实欠款以正式应收应付工作台为准。

### 本地运行

```powershell
cd 'D:\YC_Agricultural machinery'
pnpm install
docker compose -f infra/compose/compose.yaml up -d
Copy-Item apps/api/.env.example apps/api/.env
pnpm db:generate
pnpm --dir apps/api prisma:deploy
pnpm db:seed
pnpm dev
```

浏览器打开终端显示的客户端地址，并进入“商品”。系统会自动使用 A「田野中枢」桌面布局或 C「移动门店」手机布局。接口文档默认位于 `http://localhost:3000/api/docs`。构建验证命令为 `pnpm client:build` 和 `pnpm api:build`。

进入正式功能开发前，项目负责人需要确认以下事项：

- 使用场所、门店/仓库数量和预计用户数；
- 是否需要在完全断网时开单；
- 现有 Excel、纸账及期初库存/欠款的数据质量；
- 小票、A4 单据、标签、扫码枪和条码打印机型号；
- 是否需要发票、税务申报或正式总账（首版默认不包含）。

上述现场信息仍需在对应模块开工前确认。用户已明确暂不开发经营费用与其他收入，并暂缓仓库调拨。库存盘点、报损和库存流水明细查询已完成；销售单已支持正式门店抬头、A4/80mm 打印、保存图片和系统分享。客户与供应商对账单均已支持按期间重建正式欠款流水、A4 打印、保存图片和手机分享。客户收款凭证与供应商付款凭证均已支持正式过账后自动预览、历史补打、A4/80mm、保存图片、系统分享及反核销失效标识。独立退款、银行对账和采购订单留在后续阶段。
