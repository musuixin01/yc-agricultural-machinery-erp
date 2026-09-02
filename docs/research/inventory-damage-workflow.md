# 库存报损流程调研与玉春决策

## 调研对象

- [Odoo 18 Scrap inventory](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/scrap_inventory.html)：报废/损坏商品使用独立 Scrap Order，从可用库存移至报废虚拟库位；可关联原业务单据，正式确认后形成商品移动记录。
- [Odoo 19 Inventory management](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management.html)：明确区分盘点调整位置与 Scrap 报损位置，二者都是库存损失但业务原因不同。
- [ERPNext Stock Entry](https://docs.frappe.io/erpnext/stock-entry)：Material Issue 从来源仓扣减商品，数量、估值率和金额由库存估值带出；Scrap Entry 可作为独立业务类型并限制用户权限。
- [ERPNext Stock Reconciliation](https://docs.frappe.io/erpnext/stock-reconciliation)：盘点用于账实差异，不能与明确知道原因的损坏出库混用。

## 适用于玉春的结论

1. 报损是独立库存出库单，不是盘点差异、销售退货或错单冲销。
2. 操作员填写仓库、商品、数量和原因；服务端在正式过账时重新锁定并检查真实库存。
3. 报损按过账时移动平均成本减少库存数量和库存价值；全部报损时使用余额中的精确总成本，避免舍入残差。
4. 任一商品库存不足时整张单据回滚，不允许部分商品成功、部分商品失败。
5. 正式过账一次写入单据状态、不可变库存流水、余额、幂等记录、审计和 outbox。
6. 玉春首版不创建法定会计损失科目，也不冒充利润表；报损成本只作为经营库存损失供后续报表使用。
7. 首版不追踪可回收残值、报废虚拟库位、批次/序列号和照片附件；这些能力需要单独确认业务与存储规则。
