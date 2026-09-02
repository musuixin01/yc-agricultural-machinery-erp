import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useProducts } from "../catalog/use-catalog";
import { useWarehouses } from "../warehouses/use-warehouses";
import { useCreateOpening } from "./use-inventory";

type Line = { productId: string; quantity: string; unitCost: string };

export function CreateOpeningDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const products = useProducts("", "", "ACTIVE");
  const warehouses = useWarehouses("", "ACTIVE");
  const create = useCreateOpening();
  const available = useMemo(
    () => products.data?.items.filter((item) => item.type !== "SERVICE") ?? [],
    [products.data],
  );
  const [warehouseId, setWarehouseId] = useState("");
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<Line[]>([
    { productId: "", quantity: "", unitCost: "0" },
  ]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && !warehouseId && warehouses.data?.items.length) {
      setWarehouseId(
        warehouses.data.items.find((item) => item.isDefault)?.id ??
          warehouses.data.items[0].id,
      );
    }
  }, [open, warehouseId, warehouses.data]);
  if (!open) return null;

  const patchLine = (index: number, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await create.mutateAsync({ warehouseId, businessDate, lines });
      setLines([{ productId: "", quantity: "", unitCost: "0" }]);
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
        aria-labelledby="opening-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>库存正式账本</small>
            <h2 id="opening-title">建立期初库存</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="opening-warning">
            <strong>先保存草稿</strong>
            <span>
              草稿提交后仍不会改变库存；再次确认“正式过账”才会写入不可修改的库存流水。
            </span>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>仓库 *</span>
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
            <label>
              <span>业务日期 *</span>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="opening-lines-title">
            <strong>商品明细</strong>
            <button
              type="button"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { productId: "", quantity: "", unitCost: "0" },
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
                  <span>数量</span>
                  <input
                    value={line.quantity}
                    onChange={(e) =>
                      patchLine(index, { quantity: e.target.value })
                    }
                    inputMode="decimal"
                    pattern="\d{1,13}(\.\d{1,6})?"
                    placeholder="0"
                    required
                  />
                </label>
                <label>
                  <span>单位成本（元）</span>
                  <input
                    value={line.unitCost}
                    onChange={(e) =>
                      patchLine(index, { unitCost: e.target.value })
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
                  aria-label="删除商品行"
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          {error && (
            <p className="catalog-form-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" disabled={create.isPending}>
              {create.isPending ? "正在保存…" : "保存为草稿"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
