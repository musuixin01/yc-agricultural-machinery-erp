# 库存调拨流程调研与玉春决策

## 调研结论

- ERPNext 将仓库间移动建模为 Material Transfer：必须同时指定来源仓与目标仓，商品和数量保存在正式库存单据中；较长运输可另设在途仓并分发出、收货两步完成。
- Odoo 将内部调拨视为公司库存内部的位置移动。内部到内部不会改变公司拥有的总数量和总价值，只改变商品所在仓库或库位。
- 玉春首版只有同一经营主体下的门店/仓库，先实现“即时调拨”；确认过账时同一事务同时扣减调出仓并增加调入仓，不先开放在途、分批收货和跨主体调拨。

## 首版业务边界

1. 调出仓和调入仓都必须启用且不能相同。
2. 草稿只录商品和数量；成本由服务端在过账时读取调出仓锁定后的移动平均成本，客户端不得填写成本。
3. 任一商品库存不足时整单回滚，目标仓不得出现部分入库。
4. 每一行同时写一条调出流水和一条调入流水，数量与成本绝对值相同，因此公司总数量和总库存成本不变。
5. 两个仓库的余额必须按固定顺序锁定，避免两张反向调拨互相死锁。
6. 已过账调拨不可修改或删除；纠错使用关联反向调拨，不直接改流水。
7. 在途、收货确认、运输损耗、批次/序列号和跨主体结算留到后续版本。

## 实现前的数据约束

当前库存流水对 `source_document_line_id` 单列唯一，而一次调拨的同一商品需要调出、调入两条流水。实现调拨前应将约束升级为“来源行 + 仓库唯一”，同时保留过账幂等键和数据库不可变触发器；迁移后必须回归采购、销售、退货、盘点和报损的重复过账保护。

## 参考资料

- [ERPNext Stock Entry](https://docs.frappe.io/erpnext/stock-entry)
- [ERPNext Goods in Transit](https://docs.frappe.io/erpnext/how-to-manage-material-transfers-and-goods-in-transit)
- [Odoo Inventory Management](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management.html)
- [Odoo Stock Movement Valuation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/inventory_valuation/operations_valuation.html)
