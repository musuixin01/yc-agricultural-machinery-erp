# 数据模型说明

## 1. 建模原则

- 主键使用服务端生成的 UUID/ULID 类标识；另设人类可读单据编号。
- 金额使用 `numeric(19,4)` 或经确认的定点精度；币种字段必填。
- 数量建议 `numeric(19,6)`，界面按商品单位显示合适小数位。
- 业务日期与创建时间分开；审计时间用 UTC，展示转换到中国时区。
- 关键业务表包含 `created_at/by`、`updated_at/by`、版本号和状态。
- 已过账流水只追加不覆盖；软删除也不能用来隐藏财务历史。
- 数据库使用外键、唯一约束、检查约束和必要索引守住底线。

## 2. 主要实体

### 基础资料

- `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
- `parties`（客户/供应商共用主体）, `party_roles`, `party_contacts`
- `products`, `product_categories`, `brands`, `product_barcodes`
- `units`, `product_unit_conversions`, `product_compatibilities`
- `warehouses`, `locations`, `cash_accounts`
- `business_profiles`（正式门店抬头与打印默认参数，首版单例）

### 交易

- `purchase_documents`, `purchase_lines`
- `sales_documents`, `sales_lines`
- `inventory_documents`, `inventory_lines`
- `inventory_stocktakes`, `inventory_stocktake_lines`
- `inventory_damage_documents`, `inventory_damage_lines`
- `payments`, `payment_allocations`
- `expenses`, `other_incomes`, `account_transfers`

### 账本与审计

- `inventory_ledger_entries`
- `inventory_balances`（可重建快照）
- `receivable_entries`, `payable_entries`
- `party_balance_snapshots`（可重建快照）
- `audit_logs`, `outbox_messages`, `idempotency_records`
- `attachments`, `import_jobs`, `export_jobs`

## 3. 关键关系

```text
Party 1 ── * SalesDocument 1 ── * SalesLine * ── 1 Product
Party 1 ── * PurchaseDocument 1 ── * PurchaseLine * ── 1 Product

Posted Document 1 ── * InventoryLedgerEntry
InventoryStocktake 1 ── * InventoryStocktakeLine
InventoryDamageDocument 1 ── * InventoryDamageLine
Posted Document 1 ── * ReceivableEntry / PayableEntry
Payment 1 ── * PaymentAllocation * ── 1 Receivable/Payable Document
Payment 1 ── 0..1 PaymentReversal 1 ── * ReversalAllocation
CashTransfer 1 ── 2 CashLedgerEntry（转出与转入）

Product 1 ── * ProductBarcode
Product 1 ── * ProductUnitConversion
Product * ── * CompatibleMachineModel
```

## 4. 单据头与明细

单据头保存：编号、类型、状态、业务日期、往来单位、仓库、币种、金额汇总、备注、版本、创建/提交/过账/冲销信息。

单据明细保存：商品快照名称、商品 ID、单位、换算率、数量、单价、折扣、金额、成本快照、税务预留字段、来源明细 ID。保存必要快照，避免以后商品改名导致历史单据失真。

## 5. 库存账

每条 `inventory_ledger_entry` 至少包含：

- 商品、仓库/库位；
- 方向或带符号数量、基础单位数量；
- 单位成本、成本金额；
- 来源单据类型/ID/明细 ID；
- 业务日期、过账时间、操作者；
- 冲销来源（如适用）。

`inventory_balances` 以商品 + 仓库（+ 批次/序列号）为唯一粒度，使用事务内条件更新。必须有离线对账作业比较余额快照与流水汇总。

`inventory_stocktake_lines` 保存创建盘点时的账面数量、总成本、平均成本和余额版本，以及操作员录入的实盘数量、服务端计算的差异和差异原因。盘点过账必须重新锁定并核对基准版本与金额，不能以旧快照覆盖盘点期间发生的正式库存业务。

`inventory_damage_documents` 与 `inventory_damage_lines` 保存报损仓库、日期、商品快照、数量和原因。成本不由客户端或草稿提供；正式过账读取锁定后的 `inventory_balances`，将实际移动平均成本写入 `inventory_ledger_entries`，从而让报损成本可追溯且不会使用过期客户端数据。

## 6. 往来账

应收应付不使用一个可随意编辑的 `balance` 字段作为唯一依据。发生、核销与冲销分别记录：

- 业务发生条目：原始金额、未结金额、到期日、来源单据；
- 收付款：资金账户、金额、方向、状态；
- 核销：收付款与发生条目之间的多对多金额；
- 反核销：唯一引用原收付款和原核销关系的不可变反向单据；
- 余额快照：按主体快速查询，可由上述数据重建。

客户预收和供应商预付必须与普通未核销欠款区分展示。

## 7. 商品规格策略

- 常用、需要筛选和校验的字段结构化存储，例如螺丝直径/长度/牙距。
- 长尾属性可使用经 schema 管理的 JSONB，但核心报表字段不得全塞 JSON。
- SKU 表示可独立定价和计库存的最小规格；不同规格不可只写在备注里。
- 单位换算记录分子/分母，禁止使用近似浮点数。

## 8. 编号规则

推荐格式：`SO-20260812-0001`、`PO-...`、`RC-...`、`PY-...`。编号由服务端生成，数据库保证唯一。编号允许断号，不以“连续无断号”作为数据正确性依据。

## 9. 索引基线

- 单据编号唯一索引；条码在有效商品范围唯一索引；
- 商品名称/助记码/型号采用适合中文检索的索引策略并实测；
- 往来单位 + 业务日期、状态 + 日期、未结金额查询索引；
- 库存余额商品 + 仓库唯一索引；流水来源单据索引；
- 审计按对象 + 时间、操作者 + 时间索引。

任何新增索引必须结合真实查询和执行计划，避免无节制写入开销。

## 10. 迁移规则

- 迁移脚本进入版本控制并在类生产数据副本上验证。
- 破坏性迁移采用扩展—迁移数据—切换—收缩，不在一个发布中直接删列。
- 上线前自动备份；失败可恢复应用版本与数据库兼容状态。
- 种子数据只包含系统枚举/权限，不混入真实客户或密码。
