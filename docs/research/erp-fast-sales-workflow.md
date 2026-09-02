# 小型零售 / 批发门店快速销售流程调研

> 状态：产品与交互预研，供销售开单流程改造使用
> 调研日期 / 资料访问日期：2026-08-31
> 适用范围：门店现结、散客销售、老客户赊销、扫码开单、库存扣减、挂单与移动端操作
> 证据边界：本文仅引用 Odoo、ERPNext、Shopify、Square 的第一方官方文档。官方产品的做法是事实；“本项目建议”是结合农机配件零售 / 批发场景作出的设计推论，不表示这些产品采用了完全相同的内部实现。

## 1. 结论摘要

成熟 POS 的共同方向不是让收银员依次“保存草稿 → 提交核对 → 正式过账”，而是：

1. 门店或收银设备预先确定默认仓库 / 门店、默认付款方式，必要时再预设默认客户；
2. 收银员扫码、搜索或点常用商品，将商品直接加入购物车；
3. 客户通常可不选，只有会员、赊销、开票、配送等场景才要求识别客户；
4. 点击“收款 / 结算”，选择付款方式并确认后即完成销售；库存、订单、资金或应收变化由系统在后台完成；
5. “挂单 / 草稿”用于顾客稍后回来、报价或暂不付款，不应成为每笔现结销售的必经步骤。

**本项目建议采用“一次确认、后台原子过账”的快销流程：**

```text
扫码 / 搜索加商品 → 收款（默认现金，可切换）→ 确认收款并完成
                         ├─ 现结：生成正式销售 + 扣库存 + 记资金
                         └─ 赊销：选客户和到期日 → 生成正式销售 + 扣库存 + 记应收
```

前台不再暴露“提交核对”和“正式过账”两个连续动作。系统内部仍应保留严谨的服务端校验、不可变过账和冲销审计，只是把这些实现细节收进一次“完成销售”动作中。

## 2. 官方产品的具体做法

### 2.1 Odoo POS

- POS 主界面允许点击商品加入购物车、搜索商品，或调用摄像头扫码；完成后进入 Payment，选择付款方式并 Validate。客户和订单备注都是可选步骤。[Odoo POS Workflow](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/use.html)
- Odoo 明确说明，登记客户主要用于积分 / 奖励、专属价目表或开具发票；可以在 POS 中新建并自动关联到当前订单。这说明普通散客现结不必先建客户档案。[Odoo POS Workflow](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/use.html)
- 收银台可暂放当前订单并新建另一单，也能在多个进行中订单之间切换；这是“挂单”能力，而不是正常结算的必经状态。[Odoo POS Workflow](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/use.html)
- 扫码器用于把商品直接加入购物车；商品必须先分配条码。Odoo 还支持重量、价格、折扣等条码规则。[Odoo POS Shop Features](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/shop.html)
- 可配置现金、银行卡、二维码、客户账户等付款方式；部分已配置的付款方式可以作为快捷按钮，一次点击就验证订单并进入小票页。[Odoo POS Payment Methods](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/payment_methods.html)
- POS 中可显示商品可用库存。对于批次 / 序列号缺失，Odoo 会提示并要求确认，但其是否阻止销售取决于产品和追踪设置。[Odoo POS Products](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/products.html)
- 缺货但仍需成交时，Odoo 的 Ship Later 流程要求选择客户和地址，并从配置的仓库创建后续配送单。这体现了“立即交付”和“后续履约”应是不同的业务路径。[Odoo POS Shop Features](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/shop.html)

### 2.2 ERPNext POS

- POS Profile 可以预设公司、仓库、客户、付款方式和默认付款方式，并能按用户设为默认；如果未配置付款方式则默认现金。还可隐藏无库存商品，并让筛选到的唯一商品自动加入购物车。[ERPNext POS Profile](https://docs.frappe.io/erpnext/pos-profile)
- 默认仓库是库存影响的前提；Item 和 POS Profile 都配置仓库时，POS Profile 的仓库优先。标准前台流程是选客户、加商品、Pay、选付款方式、Submit 后生成 POS Invoice。[ERPNext POS Workflows](https://docs.frappe.io/erpnext/pos-workflows)
- ERPNext 为提高前台速度，把每笔 POS Invoice 先放入 POS 子账，日终关闭 POS 会话时再汇总创建库存和会计分录；开放会话中的 POS 销量仍会被预留并影响可售数量，因此不能因为总账尚未汇总就重复销售同一库存。[ERPNext POS Invoice Consolidation](https://docs.frappe.io/erpnext/pos-invoice-consolidation)
- 库存不足时，POS 会阻止交易；系统也提供全局或单品允许负库存的选项，但官方说明负库存会带来后续估值调整，并建议避免或先补录正确的入库。[ERPNext POS Invoice Consolidation](https://docs.frappe.io/erpnext/pos-invoice-consolidation)；[ERPNext Stock Settings](https://docs.frappe.io/erpnext/stock-settings)；[ERPNext Negative Stock and COGS](https://docs.frappe.io/erpnext/stock-adjustment-cogs-with-negative-stock)
- 普通销售发票的 Draft 状态没有账簿影响；Submit 且启用 Update Stock 后才更新库存和会计。这个两阶段规则适合后台制单，但 ERPNext 的 POS 已把前台动作简化成一次 Submit。[ERPNext Sales Invoice](https://docs.frappe.io/erpnext/sales-invoice)

### 2.3 Shopify POS

- Shopify POS 在 iOS / Android 上运行，以“为每位顾客创建购物车 → 修改购物车 → 接受付款”为核心，并按所选门店位置同步订单和库存。[Shopify POS Overview](https://help.shopify.com/en/manual/sell-in-person/shopify-pos)
- 支持外接扫码器或设备摄像头；标准交易模式下，扫描商品条码会自动加入购物车，也可以直接在搜索栏查找商品、订单和客户。[Shopify POS Barcode Scanners](https://help.shopify.com/en/manual/sell-in-person/hardware/barcode-scanners)
- 每台 POS 设备选择销售地点，只有分配给该地点的商品可加入购物车；销售完成后扣减该地点库存。库存跟踪让 POS 显示地点库存和缺货警告，但 Shopify 官方也说明 POS 员工在库存有限或为 0 时仍可确认继续销售，因此它不是一律硬阻断。[Shopify POS Inventory](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/products)；[Shopify Selling Out of Stock](https://help.shopify.com/en/manual/products/inventory/setup/selling-when-out-of-stock)
- 客户资料能关联购买历史、数字小票等，但只有在 POS Pro 中才可配置为“建议填写”或“必须填写”，说明默认流程不需要强制选客户。[Shopify POS Customer Management](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/customer-management)
- 顾客临时离开时，可把购物车保存成草稿订单，之后从当前地点、其他地点或后台重新载入并完成结账。草稿是明确的“稍后完成”分支。[Shopify POS Draft Orders](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/order-management/draft-orders)

### 2.4 Square POS

- Square 的常用商品网格可以把热门商品、分类、折扣等做成快捷入口，并在同一地点的设备间同步，目标是减少查找和排队时间。[Square Item Grid](https://squareup.com/help/us/en/article/8334-set-up-item-grid)
- Square Handheld 可连续扫描商品加入顾客订单，也能扫描查看库存；未登记条码时会提示创建商品，而不是把技术错误直接暴露给收银员。[Square Handheld Barcode Scanning](https://squareup.com/help/us/en/article/8506)
- 客户可以在销售前、销售中或销售后关联；销售中从当前结账页即可新增客户，证明客户识别不是完成普通收款的硬前置条件。[Square Customer Directory](https://squareup.com/help/us/en/article/5498-manage-your-customer-directory-online)
- Open Tickets 允许在移动设备上保存未完成订单，之后继续编辑和付款，多台设备可访问；它与 Shopify 草稿订单一样是“稍后结算”能力。[Square Open Tickets](https://squareup.com/help/us/en/article/5337-use-open-tickets-with-square)
- Square 默认把售罄商品从结账选择中隐藏，也可把售罄选项排到末尾并标记；库存跟踪开启后，POS 销售会更新库存数量。[Square Sold Out Items](https://squareup.com/help/us/en/article/8430-mark-items-and-modifiers-as-sold-out)；[Square Inventory Levels](https://squareup.com/help/us/en/article/8331-set-up-inventory-tracking)
- 移动端可用 Favorites 商品网格作为主要入口，说明高频商品的大触控快捷区与扫码 / 搜索应并存，不应把桌面长表单原样缩到手机上。[Square Item Grid](https://squareup.com/help/us/en/article/8334-set-up-item-grid)

## 3. 面向本项目的推荐设计

### 3.1 默认值：由“收银工作台配置”承担

为每个用户或设备保存一个销售工作台配置：

- 默认门店 / 仓库；
- 默认库位（仅仓库确实启用库位管理时显示）；
- 默认收款账户与默认付款方式，建议门店初始为“现金”；
- 默认价目表、税率和小票模板；
- “散客”作为界面语义上的默认客户，但不要求收银员每单手工选择；
- 是否允许赊销、改价、折扣、负库存、跨仓出库等权限。

仓库在进入收银工作台时已经确定，商品库存按该仓库展示。普通销售页不应每次再让用户选择仓库；需要跨仓时走“切换仓库 / 调拨 / 后续配送”的明确流程。

### 3.2 客户：现结可匿名，赊销必须实名

- **现结散客：** 默认显示“散客”，可直接结算，不建立大量没有价值的客户记录。
- **会员 / 老客户：** 可选客户，用于历史价、折扣、售后、积分或电子小票。
- **赊销 / 欠款：** 必须选已建档客户，并显示当前应收、信用额度和到期日。
- **配送 / 预订 / 开票：** 必须选客户，并补齐对应的地址或开票资料。

这样既保留快销效率，也不牺牲应收和履约的可追溯性。

### 3.3 加商品：一个输入框，三种入口

顶部只保留一个始终聚焦的“扫码 / 名称 / 编码 / 条码”输入框：

- 扫码唯一命中：直接加 1 件；连续扫码相同商品时数量递增；
- 文本唯一命中：可配置为直接加入；
- 多结果：按名称、规格、编码、售价和当前仓可售数展示，用户点选；
- 未找到条码：用中文提示“未找到该条码”，并提供“换关键词搜索”或有权限时“新建商品”；
- 桌面端保留键盘快捷键，手机端提供摄像头扫码和常用商品大按钮。

### 3.4 结算：现结一次完成，赊销显式切换

购物车主按钮根据模式变化：

- 默认：`收款 ¥36.00`；
- 现金：默认实收等于应收，点一次确认即可完成；需要找零时再展开实收金额；
- 微信 / 支付宝 / 银行卡：选择方式后确认完成；
- 组合支付：从“更多付款方式”进入，不占用默认流程；
- 赊销：显式切换为“记客户欠款”，要求客户和到期日，按钮变为 `确认赊销`；
- 暂不结算：选择 `挂单`，保存当前购物车，之后可继续。

后端在一次正式动作中完成销售单、库存、资金 / 应收和审计记录。成功页仅保留“打印 / 分享小票”和“下一单”。

### 3.5 草稿、付款与过账的状态边界

建议面向用户只暴露三个易懂状态：

- `挂单`：尚未成交，可继续编辑；不扣正式库存、不记资金和应收，但可按策略预留库存；
- `已完成`：已现结或已确认赊销；正式扣库存并记资金 / 应收；
- `已取消 / 已退货`：通过冲销或退货单处理，保留原单，不直接修改已完成记录。

内部可以保留更细的服务端状态和幂等控制，但不要把 `DRAFT / SUBMITTED / POSTED` 直接翻译成三个连续按钮给门店用户。

**接口契约建议：** 客户端只提交当前结算意图，例如购物车、客户、支付分配、赊销到期日和幂等键；销售时间由服务端确认时生成，结算类型由支付 / 赊销选择推导。不要让客户端同时发送多组含义重叠或已废弃的字段，否则很容易出现“界面已有字段，但接口禁止字段”的错误。

### 3.6 缺货与负库存

默认策略应为不允许负库存：

- 搜索结果和购物车直接显示当前仓可售数；数量达到上限后禁用继续增加；
- 售罄商品可隐藏或置底并明确标记，不要等用户结算后才报错；
- 其他仓有货时显示“其他仓有货”，提供调拨或切换履约仓，而不是静默扣错仓；
- 确需先卖后补时，改走“预订 / 后续配送 / 缺货订单”，要求客户和预计交付信息，不伪装成现货销售；
- 只有授权管理人员可临时负库存，并必须填写原因；序列号 / 批次商品不开放负库存。

### 3.7 响应式布局

**桌面 / 平板横屏：** 左侧为扫码、搜索和常用商品，右侧固定购物车与合计；收款按钮固定在右下方。收银员无需上下滚动即可完成一单。

**手机竖屏：**

- 顶部固定扫码 / 搜索；
- 中部显示最近 / 常用商品和搜索结果；
- 底部固定“购物车（件数） · 合计 · 收款”主按钮；
- 点开购物车后用底部抽屉编辑数量、价格和删除；
- 客户、赊销、备注、改价放在次级操作区，不与扫码和收款争抢首屏；
- 触控目标使用足够大的按钮，关键数字不依赖浅色小字。

上述布局是本项目建议。可验证的产品依据是：Shopify POS 和 Square POS 都支持 iOS / Android；Shopify 用可配置 Smart Grid 放置高频商品和功能，Square 的手机界面通过 Review Sale 进入购物车，而平板 / Stand 会持续显示右侧销售明细。[Shopify Smart Grid](https://help.shopify.com/en/manual/sell-in-person/getting-started/smart-grid)；[Square Build Cart](https://squareup.com/help/us/en/article/8238-build-your-customer-s-cart-in-the-square-retail-pos-app)

## 4. 推荐的最小主流程

### 4.1 现结散客

1. 打开销售页，系统自动载入当前用户的默认仓库、散客和现金账户。
2. 扫码或搜索商品；唯一命中直接加入购物车。
3. 系统实时限制数量不超过可售库存。
4. 点击 `收款 ¥金额`。
5. 默认现金且金额一致时，点击 `确认收款`。
6. 服务端一次性创建正式销售、扣减库存并登记资金；前台进入小票 / 下一单页。

正常情况下，一笔销售只需要“扫码 + 两次点击”，不需要先保存草稿或单独过账。

### 4.2 客户赊销

1. 加商品后切换 `赊销`。
2. 选择客户；显示应收余额和信用信息。
3. 选择到期日并确认赊销。
4. 服务端一次性创建正式销售、扣减库存并新增客户应收。

### 4.3 缺货订单

1. 商品不足时，系统在加购阶段提示，不允许按现货数量继续。
2. 用户选择其他仓调拨，或建立“预订 / 后续配送”。
3. 后续履约必须关联客户、仓库和预计日期；到货 / 调拨后再完成正式出库。

## 5. 对当前销售页报错的产品层启示

当前界面报错直接显示 `property ... should not exist`，表明前端提交了服务端不接受的字段。这类内部校验信息不应直接呈现给门店用户。

建议同时处理两层：

1. **契约修复：** 前端请求体只发送接口当前允许的字段；销售时间、现结 / 赊销分类等能由服务端推导的值不要重复提交。
2. **用户提示：** 服务端校验错误映射为中文业务提示，例如“销售单数据已过期，请刷新后重试”；技术字段名和验证器原文只写入诊断日志。

更重要的是，把当前销售页从“填写销售时间、选择结算字段、提交后再过账”的后台单据式交互，调整为本报告的 POS 式一次结算流程。这样既减少字段冲突，也直接解决用户感觉“太麻烦”的根本问题。

## 6. 实施优先级

1. 先修复当前请求字段不匹配和英文技术报错，恢复可成交性。
2. 将现结改为一次“确认收款并完成”，内部自动正式过账。
3. 增加按用户 / 设备保存的默认仓库、散客和付款方式。
4. 统一扫码 / 名称 / 编码输入，唯一命中自动加入。
5. 在加购阶段显示并限制可售库存，完善其他仓 / 缺货订单分支。
6. 增加挂单恢复、常用商品网格和手机底部固定结算栏。
7. 最后再做组合支付、信用额度、跨仓履约和离线草稿等增强功能。
