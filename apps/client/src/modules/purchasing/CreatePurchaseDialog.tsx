import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useProducts } from "../catalog/use-catalog";
import { useParties } from "../parties/use-parties";
import { useWarehouses } from "../warehouses/use-warehouses";
import { useCreatePurchase } from "./use-purchasing";

type Line = { productId: string; quantity: string; unitPrice: string };
const today = () => new Date().toISOString().slice(0, 10);

export function CreatePurchaseDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const suppliers = useParties("", "SUPPLIER");
  const warehouses = useWarehouses("", "ACTIVE");
  const products = useProducts("", "", "ACTIVE");
  const create = useCreatePurchase();
  const available = useMemo(
    () => products.data?.items.filter((item) => item.type !== "SERVICE") ?? [],
    [products.data],
  );
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [businessDate, setBusinessDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [lines, setLines] = useState<Line[]>([
    { productId: "", quantity: "", unitPrice: "0" },
  ]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!supplierId && suppliers.data?.items.length)
      setSupplierId(suppliers.data.items[0].id);
    if (!warehouseId && warehouses.data?.items.length)
      setWarehouseId(
        warehouses.data.items.find((item) => item.isDefault)?.id ??
          warehouses.data.items[0].id,
      );
  }, [open, supplierId, warehouseId, suppliers.data, warehouses.data]);
  useEffect(() => {
    const supplier = suppliers.data?.items.find(
      (item) => item.id === supplierId,
    );
    if (!supplier) return;
    const date = new Date(`${businessDate}T00:00:00`);
    date.setDate(date.getDate() + supplier.paymentTermsDays);
    setDueDate(date.toISOString().slice(0, 10));
  }, [supplierId, businessDate, suppliers.data]);
  if (!open) return null;

  const patchLine = (index: number, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await create.mutateAsync({
        supplierId,
        warehouseId,
        businessDate,
        dueDate,
        lines,
      });
      setLines([{ productId: "", quantity: "", unitPrice: "0" }]);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "保存失败，请稍后重试",
      );
    }
  }

  return (
    <div
      className="catalog-dialog-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="catalog-dialog opening-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>采购入库与供应商欠款</small>
            <h2 id="purchase-title">新建采购入库单</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="opening-warning">
            <strong>录入实际到货</strong>
            <span>
              过账会增加真实库存、重新计算平均成本并形成供应商欠款，请按验收数量填写。
            </span>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>供应商 *</span>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">请选择供应商</option>
                {suppliers.data?.items
                  .filter((item) => item.status === "ACTIVE")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>收货仓库 *</span>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
              >
                {warehouses.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>业务日期 *</span>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                required
              />
            </label>
            <label>
              <span>付款到期日 *</span>
              <input
                type="date"
                min={businessDate}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="opening-lines-title">
            <strong>到货商品</strong>
            <button
              type="button"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { productId: "", quantity: "", unitPrice: "0" },
                ])
              }
            >
              <Plus />
              添加一行
            </button>
          </div>
          <div className="opening-lines">
            {lines.map((line, index) => (
              <div className="opening-line" key={index}>
                <label>
                  <span>商品</span>
                  <select
                    value={line.productId}
                    onChange={(e) =>
                      patchLine(index, { productId: e.target.value })
                    }
                    required
                  >
                    <option value="">请选择商品</option>
                    {available.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={lines.some(
                          (other, i) =>
                            i !== index && other.productId === item.id,
                        )}
                      >
                        {item.name} · {item.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>实收数量</span>
                  <input
                    value={line.quantity}
                    onChange={(e) =>
                      patchLine(index, { quantity: e.target.value })
                    }
                    inputMode="decimal"
                    pattern="\d{1,13}(\.\d{1,6})?"
                    required
                  />
                </label>
                <label>
                  <span>采购单价（元）</span>
                  <input
                    value={line.unitPrice}
                    onChange={(e) =>
                      patchLine(index, { unitPrice: e.target.value })
                    }
                    inputMode="decimal"
                    pattern="\d{1,15}(\.\d{1,4})?"
                    required
                  />
                </label>
                <button
                  type="button"
                  className="opening-remove"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" disabled={create.isPending}>
              {create.isPending ? "正在保存…" : "保存采购草稿"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
