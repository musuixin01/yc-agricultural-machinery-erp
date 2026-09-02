# 玉春 YC 农机 ERP：真实经营看板模式调研

> 调研日期：2026-09-01
> 目的：为“真实经营看板”确定少而关键的指标、统一计算口径和移动端信息层级。本文只引用成熟开源 ERP 的官方文档、官方源码和 Android 官方设计指南；结论中的“YC 决策”是结合本项目现有业务模型作出的设计取舍，不代表来源产品的原话。

## 1. 结论摘要

首版首页只展示六项可追溯的经营事实：

1. 今日销售净额；
2. 今日退货金额；
3. 客户欠款；
4. 我们欠供应商；
5. 库存预警商品数；
6. 资金余额。

桌面端可以增加“近 7 日净销售趋势”和两个待办列表；手机端不再复制完整桌面图表，只保留六张紧凑数字卡、最多三条高优先级待办和明确的下钻入口。

这一范围有成熟 ERP 的直接依据：Odoo 的标准销售看板把订单、收入、客单价和月度销售分开，并允许统一期间筛选；ERPNext 官方默认账户看板也把销售单、采购单、银行余额、收入和费用作为不同图表，而不是混成一个“经营总分”。[Odoo 官方 Dashboards 文档](https://www.odoo.com/documentation/18.0/applications/productivity/dashboards.html)；[ERPNext 官方默认看板源码](https://github.com/frappe/erpnext/blob/develop/erpnext/setup/setup_wizard/data/dashboard_charts.py)

但 YC 不应原样照搬这些大而全的指标。当前系统没有报价、销售订单、采购订单、费用和完整总账，因此首版只展示已经有正式不可变业务数据支撑的指标。任何没有真实数据来源的卡片都不得显示演示值或用 `0` 冒充已计算结果。

## 2. 六项核心指标与推荐口径

### 2.1 今日销售净额

**展示名称：** `今日销售净额`，金额为主值；次级文字显示 `销售 ¥X - 退货 ¥Y - 冲销 ¥Z`。

**推荐公式：**

```text
今日销售净额
= 今日已过账销售原额
- 今日已过账销售退货额
- 今日已过账错单冲销额
```

销售原额按正式过账事实统计，不含草稿。已经被后续冲销的原销售仍保留在原发生日；冲销在自身业务日期作为反向事实出现。这样同日冲销的净额为零，跨日冲销则分别反映两天真实发生的动作，而且任意长期间累计后仍可相互抵消。

此口径与成熟 ERP 的反向单据原则一致：Odoo 规定已验证发票通过 credit note 生成反向会计分录，退货商品的库存动作还需单独验证；ERPNext 也要求从原销售创建退货/credit note，负数量与负金额冲回相应应收、收入和税额，并保留原单审计链。[Odoo 官方 Credit notes and refunds](https://www.odoo.com/documentation/master/applications/finance/accounting/customer_invoices/credit_notes.html)；[ERPNext 官方 Sales Return](https://docs.frappe.io/erpnext/sales-return)

**禁止的算法：**

- 只加销售单、不减退货和冲销；
- 排除已冲销原单，同时又减冲销单，造成重复扣减；
- 用收款金额代替销售额：收款可能对应历史欠款或客户预收款；
- 用 `createdAt` 统计经营日；应统一使用业务日期，时间只用于排序和审计。

### 2.2 今日退货金额

**展示名称：** `今日退货`。

**推荐公式：** 当日已过账 `SalesReturn.totalAmount` 之和。它是销售净额的减项，同时独立展示用于提醒经营者今天发生了多少退货；两张卡并列时必须明确销售卡是“净额”，避免用户把两者再手工相减。

退货金额不能直接等同于现金退款。ERPNext 官方流程区分客户信用、未来抵扣与实际退款；Odoo 也明确 credit note 与退款支付、实物退回是相关但不同的动作。[ERPNext 官方 Sales Return：已付款/部分付款处理](https://docs.frappe.io/erpnext/sales-return#handle-unpaid-partially-paid-and-paid-invoices)；[Odoo 官方 Credit notes and refunds](https://www.odoo.com/documentation/master/applications/finance/accounting/customer_invoices/credit_notes.html)

因此 YC 首页显示 `SalesReturn.totalAmount`，详情页再拆分 `receivableReduction`（减少客户欠款）和 `refundAmount`（实际退款）。错误单据冲销不得混入“退货金额”。

### 2.3 客户欠款

**展示名称：** `客户欠款`；次级显示 `其中逾期 ¥X`，点击进入欠款清单。

**推荐公式：** 当前所有正式应收发生项 `outstandingAmount > 0` 的余额合计；逾期部分再增加 `dueDate < 今天` 条件。它是**时点余额**，不受首页“今日/近 7 日”筛选影响，卡片上需标注 `截至现在`。

ERPNext 官方把应收定义为要从客户收回的钱，并把发票状态区分为 Overdue、Partly Paid、Paid；付款只有分配到具体发票后才减少其 outstanding amount。[ERPNext 官方 Chart of Accounts](https://github.com/frappe/manual_erpnext_com/blob/master/manual_erpnext_com/www/contents/accounts/chart-of-accounts.md)；[ERPNext 官方 Sales Invoice](https://docs.frappe.io/erpnext/sales-invoice)

**禁止的算法：**

- 将历史销售额减历史收款额粗略相减；这会遗漏退货、冲销、反核销和预收款抵扣；
- 把客户预收款直接作为负应收。只有正式抵扣应收后，`outstandingAmount` 才下降；
- 汇总客户资料上的可编辑余额。欠款必须来自正式应收发生项。

### 2.4 我们欠供应商

**展示名称：** `我们欠供应商`，避免在经营界面写成容易误解的“供应商应收”；次级显示 `其中逾期 ¥X`。

**推荐公式：** 当前所有正式应付发生项 `outstandingAmount > 0` 的余额合计；逾期部分按 `dueDate < 今天`。

ERPNext 官方将 Accounts Payable 定义为企业需要付给供应商的钱，与 Accounts Receivable 分属负债和资产；这说明应付应作为独立时点余额，不应与采购额或现金支出混算。[ERPNext 官方 Chart of Accounts](https://github.com/frappe/manual_erpnext_com/blob/master/manual_erpnext_com/www/contents/accounts/chart-of-accounts.md)

**禁止的算法：**

- 用累计采购额减累计付款额；采购退货、供应商退款、付款反核销都会使这种算法失真；
- 把供应商预付款作为负应付；预付款只有正式抵扣后才影响具体应付余额。

### 2.5 库存预警商品数

**展示名称：** `库存预警`，主值必须带单位 `N 种`，而不是模糊的 `N`；次级显示 `其中负库存 N 种`。

**推荐公式（YC 首版）：** 对每个启用商品汇总全部启用仓库的现存数量，`总数量 <= Product.safetyStock` 时计为一项预警；没有任何库存余额行的启用商品按零库存处理。预警统计的是商品种类，不是库存件数。点击后按“负库存 → 零库存 → 低于安全库存”的优先级展示商品、数量和存放位置。

Odoo 的补货规则以预测库存低于最小数量为触发条件，手动模式会把需要补货的商品集中列在补货看板；其仓库指标看板还把负库存行作为单独异常指标。[Odoo 官方 Reordering rules](https://www.odoo.com/documentation/16.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/reordering_rules.html)；[Odoo 官方 Inventory dashboards](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/reporting/dashboards.html)

Dolibarr 官方库存模块也强调库存状态与库存移动应按商品和仓库记录，人工修正要留下原因；因此 YC 不应从商品资料中的手填数字生成库存告警。[Dolibarr 官方 Module Stocks](https://wiki.dolibarr.org/index.php/Module_Stocks_En)

> 后续如果同一商品在多个相互独立的门店仓库经营，再升级为“商品 × 仓库”阈值。当前只有商品级 `safetyStock`，首版不应凭空创造仓库级安全库存规则。

### 2.6 资金余额

**展示名称：** `资金余额`；次级显示账户数量，点击后列出现金、银行卡、微信/支付宝等各账户余额。

**推荐公式：** 所有启用资金账户当前余额之和。首页总额从正式 `CashBalance` 读取并用资金流水复核；不通过销售收款、客户收款、供应商付款等业务表临时拼接余额。

ERPNext 官方默认账户看板直接以 Bank 类型账户的账户余额时间线生成 Bank Balance 图，而销售发票、采购发票、收入和费用是另外的图表，支持资金与经营发生额分离。[ERPNext 官方默认看板源码](https://github.com/frappe/erpnext/blob/develop/erpnext/setup/setup_wizard/data/dashboard_charts.py)

YC 的账户间转账会同时产生等额转出与转入，因此所有账户总余额净变化必须为零。若通过各业务表重复累加，转账很容易被误记成收入或支出。

## 3. 防止重复计算的统一规则

| 经营事实 | 首页指标中的作用 | 不得再次计入 |
| --- | --- | --- |
| 销售过账 | 增加销售原额；现结同时产生资金，赊账同时产生应收 | 不因后续收款再增加销售额 |
| 销售退货 | 减少销售净额；另计今日退货；可能减少应收或减少资金 | `receivableReduction + refundAmount` 不能再从销售净额重复扣一次 |
| 销售冲销 | 在冲销业务日减少销售净额 | 不能同时排除原销售又减冲销额 |
| 客户收款 | 增加资金、减少已核销应收 | 不增加销售额 |
| 客户预收款 | 增加资金和独立预收余额 | 未抵扣前不减少客户欠款，也不增加销售额 |
| 采购过账 | 增加库存并形成应付 | 不直接减少资金 |
| 供应商付款 | 减少资金、减少已核销应付 | 不减少采购发生额或库存价值 |
| 供应商预付款 | 减少资金和形成独立预付余额 | 未抵扣前不减少应付 |
| 账户转账 | 一个账户减少、另一个增加 | 总资金余额不变，绝不是收入或支出 |

ERPNext 官方特别提醒：同一退货不能同时通过退货交货单和启用 Update Stock 的 credit note 重复更新库存；这正是 YC 所有首页聚合都要坚持“一项业务事实只产生一次同类影响”的依据。[ERPNext 官方 Sales Return](https://docs.frappe.io/erpnext/sales-return#choose-the-correct-return-method)

### 时间口径

- **期间流量：** 销售、退货、冲销采用各自不可变业务日期；默认今天，可切换近 7 日或本月。
- **时点余额：** 客户欠款、我们欠供应商、库存预警、资金余额始终表示当前状态，卡片标注“截至现在”，不跟随期间筛选。
- **数据库时间：** `postedAt` 用于审计与同日排序，不代替经营日期。
- **时区：** “今天”统一按门店配置时区 `Asia/Shanghai` 划分，不以数据库 UTC 日期直接截断。

Odoo 标准看板允许以全局期间筛选所有相应数据；但 YC 同一屏同时存在流量与时点指标，必须显式区分，否则用户会误以为“近 7 日客户欠款”是当前可追收余额。[Odoo 官方 Dashboards 文档](https://www.odoo.com/documentation/18.0/applications/productivity/dashboards.html)

## 4. 推荐页面结构

### 4.1 桌面端

1. 顶部：`经营概览`、更新时间、流量期间切换（今天 / 近 7 日 / 本月）和刷新按钮。
2. 第一屏：六张核心指标卡，三列两行；销售与退货归为“经营流量”，欠款/应付/库存/资金标记“截至现在”。
3. 第二屏左侧：近 7 日销售净额折线或柱线图；只显示销售原额和净额两个系列，不叠加过多图例。
4. 第二屏右侧：待办事项，优先级依次为负库存、逾期客户欠款、低库存、逾期供应商欠款；每类最多三条并提供“查看全部”。

Odoo 仓库看板把顶部少量异常卡与下方明细/趋势分开，并在异常卡中突出逾期操作和负库存；该层级适合借鉴，但 YC 不需要复制其复杂仓储效率指标。[Odoo 官方 Inventory dashboards](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/reporting/dashboards.html)

### 4.2 手机端

- 顶部只保留标题、更新时间和刷新；期间切换用紧凑分段控件。
- 六张指标卡采用两列三行，每张只显示短标题、主数字和一行状态，不在卡内放按钮或大图标。
- 紧接一条“需处理”区域，最多三条；更多内容进入独立列表。
- 近 7 日趋势默认折叠为一条迷你趋势或移到详情页，避免首页纵向过长。
- 卡片整块可点开明细；首页不放六组独立“查看详情”文字。
- 紧凑窗口使用单栏内容流；桌面宽度增加时再重排为多列，不把手机卡片强行拉宽。

Android 官方建议紧凑尺寸采用单窗格，避免在一个视图中提供过多操作；核心操作应处于容易触达的位置。官方自适应指南还建议紧凑窗口使用底部导航，更宽窗口再切换为导航栏，并要求组件随窗口重排而非简单拉伸。[Android 官方 Adapt layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout)；[Android 官方 Layout basics](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics)；[Android 官方 Adaptive do's and don'ts](https://developer.android.com/develop/adaptive-apps/guides/adaptive-dos-and-donts)

## 5. 不适合小型农机门店的常见模板

### 5.1 复制大型销售驾驶舱

Odoo 标准销售看板包括报价数、订单数、收入、客单价、月销售、热门报价/订单、热门商品、销售员和国家等维度。[Odoo 官方 Dashboards 文档](https://www.odoo.com/documentation/18.0/applications/productivity/dashboards.html)

**不适合原因：** YC 当前直接记录成交并交付，没有报价、销售订单、销售团队和跨国地域分析。复制这类模板会出现空卡片、演示数字或伪造指标。热门商品与客单价可以在数据积累后进入“经营分析”，不应挤占首屏。

### 5.2 复制完整会计驾驶舱

ERPNext 默认账户看板包含收入、费用、银行余额和销售/采购单趋势。[ERPNext 官方默认看板源码](https://github.com/frappe/erpnext/blob/develop/erpnext/setup/setup_wizard/data/dashboard_charts.py)

**不适合原因：** YC 暂不做经营费用与其他收入，也尚非完整总账系统。现在展示“净利润、费用率、资产负债”会给经营者错误的财务结论。当前可展示销售固化毛利，但必须命名为“销售毛利”，不能冒充净利润。

### 5.3 复制复杂仓库绩效看板

Odoo 的仓库运营分析包含平均延迟、提前期、履约率、准时率、按人员/操作类型的调拨与收发任务。[Odoo 官方 Inventory dashboards](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/reporting/dashboards.html)

**不适合原因：** 小型门店以即时开单、直接出入库和快速找货为主，没有多步骤拣货、排班和分配任务；展示这些 KPI 会增加录入负担，却不能指导当天经营。负库存和低库存才是首版最有行动价值的异常。

### 5.4 手机端复制桌面端密集图表

**不适合原因：** 缩小桌面三列图表会导致字小、触控困难、页面过长。Android 官方建议紧凑屏采用单窗格并控制每屏操作数量；YC 应保留关键数字与异常入口，把图表和完整明细下钻到二级页。[Android 官方 Adapt layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout)；[Android 官方 Layout basics](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics)

## 6. 开发验收标准

1. 首页接口只从正式已过账单据、正式应收/应付、库存余额和资金余额读取，不使用前端常量或模拟数据。
2. 六项指标能下钻到构成它的单据或商品列表，并且明细合计等于卡片数字。
3. 构造“销售 → 退货”“赊账 → 收款”“预收款 → 抵扣”“账户转账”“销售 → 跨日冲销”测试链，证明没有重复计数。
4. 同日销售 100 元、退货 20 元时，销售净额为 80 元、今日退货为 20 元；不得显示销售净额 100 元后再让用户猜是否要减退货。
5. 账户 A 向 B 转账 100 元后，总资金余额不变，各账户余额分别变化。
6. 客户/供应商预收预付款未抵扣时，不改变应收/应付卡片；抵扣后只按正式 outstanding balance 变化。
7. 手机宽度使用两列紧凑指标卡；不横向滚动，不需要滑到底才能看到主导航，首页首次打开即可看到至少四项关键指标。
8. 加载失败时显示“暂时无法读取”及重试，不得以 `¥0.00` 掩盖接口错误；无业务数据时才显示经过确认的零状态。
9. 金额统一由后端以 Decimal 口径聚合，接口使用字符串传输，前端不进行浮点金额求和。
10. API 测试、数据库集成测试、客户端构建及手机/桌面视觉检查全部通过后，才可将旧演示看板替换为真实看板。
11. 每张卡都能点击进入已经带好相同期间或状态条件的明细。Odoo 官方看板支持从指标/图表下钻到底层记录，这能让首页数字可核对而不是成为孤立数字。[Odoo 官方 Build and customize dashboards](https://www.odoo.com/documentation/19.0/applications/productivity/dashboards/build_and_customize_dashboards.html)
12. 接口必须按当前用户权限返回指标；无权查看资金或欠款时隐藏对应卡片并说明原因，不能先返回全店总数再只限制明细。Odoo 官方说明看板访问权与底层模型访问权是两套控制，二者不一致会造成用户看见看板却无法读取其数据。[Odoo 官方 Dashboards：access rights](https://www.odoo.com/documentation/19.0/applications/productivity/dashboards.html#access-rights)

## 7. 最终建议

首版不要追求“图表多”，而要追求“六个数字都能对账”。后端应提供一个统一经营概览接口，同时返回口径说明所需的分项：

```text
period: 今日 / 近 7 日 / 本月
periodStart / periodEnd（半开区间 [start, end)）
salesGross
salesReturns
salesReversals
salesNet
receivablesOutstanding
receivablesOverdue
payablesOutstanding
payablesOverdue
lowStockProductCount
negativeStockProductCount
cashBalanceTotal
cashAccountCount
generatedAt
timezone
```

这里不新增净利润、费用、采购订单、报价转化率或仓库履约率。等相应业务模块拥有真实、完整、可追溯的数据后，再把它们放入独立“经营分析”页，而不是继续堆到首页。
