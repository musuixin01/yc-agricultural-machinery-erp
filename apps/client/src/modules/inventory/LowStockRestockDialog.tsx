import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Square,
  Warehouse,
  X,
} from "lucide-react";
import { useInventoryBalances } from "./use-inventory";
import { useProducts } from "../catalog/use-catalog";
import { useParties } from "../parties/use-parties";
import { useWarehouses } from "../warehouses/use-warehouses";
import { useCreatePurchase } from "../purchasing/use-purchasing";

export type LowStockItem = {
  productId: string;
  code: string;
  name: string;
  categoryName: string;
  unitName: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  safetyStock: number;
  deficit: number;
  suggestedQty: number;
  defaultPurchasePrice: string;
  selected: boolean;
  orderQty: string;
};

export function LowStockRestockDialog({
  open,
  onClose,
  onOpenPurchaseWithLines,
}: {
  open: boolean;
  onClose: () => void;
  onOpenPurchaseWithLines?: (
    lines: { productId: string; quantity: string; unitPrice: string }[],
    warehouseId?: string,
  ) => void;
}) {
  const balances = useInventoryBalances();
  const products = useProducts("", "", "ACTIVE");
  const suppliers = useParties("", "SUPPLIER");
  const warehouses = useWarehouses("", "ACTIVE");
  const createPurchase = useCreatePurchase();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [keyword, setKeyword] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [customQuantities, setCustomQuantities] = useState<
    Record<string, string>
  >({});
  const [supplierId, setSupplierId] = useState("");
  const [purchaseWarehouseId, setPurchaseWarehouseId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [error, setError] = useState("");

  // Build product lookup map for price and attributes
  const productMap = useMemo(() => {
    const map = new Map();
    products.data?.items.forEach((p) => {
      map.set(p.id, p);
    });
    return map;
  }, [products.data]);

  // Compute all items whose quantity <= safetyStock
  const lowStockList = useMemo<LowStockItem[]>(() => {
    const items: LowStockItem[] = [];
    if (!balances.data?.items) return items;

    balances.data.items.forEach((item) => {
      const currentQty = Number(item.quantity);
      const safety = Number(item.product.safetyStock || 0);

      // Trigger condition: current stock is below or equal to safety stock
      if (currentQty <= safety) {
        const prod = productMap.get(item.product.id);
        const deficit = Math.max(1, safety - currentQty);
        // Suggested qty: deficit or at least safety stock if stock is 0
        const suggested = currentQty <= 0 ? Math.max(safety, 1) : deficit;
        const defaultPrice =
          prod?.defaultPurchasePrice || item.averageCost || "0.00";

        items.push({
          productId: item.product.id,
          code: item.product.code,
          name: item.product.name,
          categoryName:
            item.product.categoryName || prod?.category?.name || "配件",
          unitName: item.product.unitName || prod?.baseUnit?.name || "个",
          warehouseId: item.warehouse.id,
          warehouseName: item.warehouse.name,
          currentStock: currentQty,
          safetyStock: safety,
          deficit,
          suggestedQty: suggested,
          defaultPurchasePrice: defaultPrice,
          selected: selectedProductIds.has(item.product.id),
          orderQty: customQuantities[item.product.id] ?? String(suggested),
        });
      }
    });

    return items;
  }, [balances.data, productMap, selectedProductIds, customQuantities]);

  // Filter by warehouse and keyword
  const filteredList = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return lowStockList.filter((item) => {
      if (selectedWarehouseId && item.warehouseId !== selectedWarehouseId) {
        return false;
      }
      if (kw) {
        return (
          item.name.toLowerCase().includes(kw) ||
          item.code.toLowerCase().includes(kw) ||
          item.warehouseName.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [lowStockList, selectedWarehouseId, keyword]);

  // Summary counts
  const totalAlerts = lowStockList.length;
  const outOfStockCount = lowStockList.filter(
    (i) => i.currentStock <= 0,
  ).length;
  const selectedItems = filteredList.filter((i) =>
    selectedProductIds.has(i.productId),
  );

  const totalEstimatedCost = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const qty = Number(customQuantities[item.productId] ?? item.suggestedQty);
      const price = Number(item.defaultPurchasePrice || 0);
      return sum + (Number.isFinite(qty) ? qty * price : 0);
    }, 0);
  }, [selectedItems, customQuantities]);

  const allSelected =
    filteredList.length > 0 &&
    filteredList.every((item) => selectedProductIds.has(item.productId));

  function toggleSelectAll() {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filteredList.forEach((item) => next.delete(item.productId));
      } else {
        filteredList.forEach((item) => next.add(item.productId));
      }
      return next;
    });
  }

  function toggleSelectItem(productId: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function handleQtyChange(productId: string, val: string) {
    setCustomQuantities((prev) => ({
      ...prev,
      [productId]: val,
    }));
  }

  // Quick action: directly create purchase draft from selected items
  async function handleCreatePurchaseDraft() {
    setError("");
    if (selectedItems.length === 0) {
      setError("请先勾选需要补货的商品。");
      return;
    }

    const targetWhId =
      purchaseWarehouseId ||
      selectedWarehouseId ||
      warehouses.data?.items.find((w) => w.isDefault)?.id ||
      warehouses.data?.items[0]?.id ||
      "wh-main";

    const targetSupplierId =
      supplierId ||
      suppliers.data?.items.find((s) => s.status === "ACTIVE")?.id ||
      "s-shougang";

    const lines = selectedItems.map((item) => {
      const qty = customQuantities[item.productId] ?? String(item.suggestedQty);
      return {
        productId: item.productId,
        quantity: qty && Number(qty) > 0 ? qty : "1",
        unitPrice: item.defaultPurchasePrice || "0.00",
      };
    });

    if (onOpenPurchaseWithLines) {
      onOpenPurchaseWithLines(lines, targetWhId);
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      await createPurchase.mutateAsync({
        supplierId: targetSupplierId,
        warehouseId: targetWhId,
        businessDate: todayStr,
        dueDate: todayStr,
        notes: `由【库存安全预警中心】一键智能生成 (${selectedItems.length}种缺货/低库存商品)`,
        lines,
      });
      setActionSuccess(true);
      setTimeout(() => {
        setActionSuccess(false);
        onClose();
      }, 1500);
    } catch (e: any) {
      setError(e?.message || "生成采购草稿单失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="catalog-dialog-backdrop" role="presentation">
      <div
        className="catalog-dialog low-stock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="low-stock-dialog-title"
      >
        <header className="low-stock-header">
          <div className="low-stock-header-title">
            <span className="low-stock-badge">
              <AlertTriangle size={16} /> 库存安全预警
            </span>
            <h2 id="low-stock-dialog-title">缺货与低库存智能补货</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="low-stock-close-btn"
            aria-label="关闭预警窗口"
          >
            <X size={18} />
          </button>
        </header>

        {actionSuccess ? (
          <div className="low-stock-success-banner">
            <CheckSquare size={24} />
            <div>
              <strong>采购草稿单创建成功！</strong>
              <span>
                已自动将 {selectedItems.length}{" "}
                种缺货商品汇总至采购管理模块，可随时复核并验收。
              </span>
            </div>
          </div>
        ) : (
          <div className="low-stock-content">
            {/* KPI Summary Cards */}
            <div className="low-stock-kpis">
              <div className="low-stock-kpi-card danger">
                <span className="kpi-label">已断货 / 零库存</span>
                <strong className="kpi-value">
                  {outOfStockCount} <small>种</small>
                </strong>
                <span className="kpi-desc">急需向供应商紧急采购补足</span>
              </div>
              <div className="low-stock-kpi-card warning">
                <span className="kpi-label">低于安全库存预警</span>
                <strong className="kpi-value">
                  {totalAlerts} <small>种</small>
                </strong>
                <span className="kpi-desc">达到再订货点，建议尽早备货</span>
              </div>
              <div className="low-stock-kpi-card primary">
                <span className="kpi-label">已选补货预计成本</span>
                <strong className="kpi-value">
                  ¥
                  {totalEstimatedCost.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
                <span className="kpi-desc">
                  已勾选 {selectedItems.length} 种商品
                </span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="low-stock-toolbar">
              <div className="low-stock-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="搜索商品名称、型号、编码..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>

              <div className="low-stock-warehouse-filter">
                <Warehouse size={15} />
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                >
                  <option value="">全部仓库预警 ({lowStockList.length})</option>
                  {warehouses.data?.items.map((wh) => {
                    const count = lowStockList.filter(
                      (i) => i.warehouseId === wh.id,
                    ).length;
                    return (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              <button
                type="button"
                className="low-stock-select-all-btn"
                onClick={toggleSelectAll}
              >
                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                {allSelected ? "取消全选" : "全选缺货商品"}
              </button>
            </div>

            {/* Warning Table */}
            <div className="low-stock-table-wrapper">
              <table className="low-stock-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={allSelected && filteredList.length > 0}
                        onChange={toggleSelectAll}
                        aria-label="选择全部"
                      />
                    </th>
                    <th>商品与编码</th>
                    <th>所在仓库</th>
                    <th style={{ textAlign: "right" }}>当前库存</th>
                    <th style={{ textAlign: "right" }}>安全库存</th>
                    <th style={{ textAlign: "right" }}>缺口/建议</th>
                    <th style={{ textAlign: "center", width: 110 }}>
                      本次采购量
                    </th>
                    <th style={{ textAlign: "right" }}>参考采购价</th>
                    <th style={{ textAlign: "right" }}>小计</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((item) => {
                    const isSelected = selectedProductIds.has(item.productId);
                    const qtyVal =
                      customQuantities[item.productId] ??
                      String(item.suggestedQty);
                    const numQty = Number(qtyVal) || 0;
                    const lineSubtotal =
                      numQty * Number(item.defaultPurchasePrice || 0);
                    const isZeroStock = item.currentStock <= 0;

                    return (
                      <tr
                        key={`${item.productId}-${item.warehouseId}`}
                        className={`low-stock-row ${isSelected ? "selected" : ""} ${isZeroStock ? "zero-stock" : ""}`}
                        onClick={() => toggleSelectItem(item.productId)}
                      >
                        <td
                          style={{ textAlign: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.productId)}
                            aria-label={`勾选 ${item.name}`}
                          />
                        </td>
                        <td>
                          <div className="product-cell">
                            <span className="product-name">{item.name}</span>
                            <span className="product-code-badge">
                              {item.code}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="warehouse-pill">
                            {item.warehouseName}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className={`stock-badge ${isZeroStock ? "stock-zero" : "stock-low"}`}
                          >
                            {item.currentStock.toLocaleString("zh-CN")}{" "}
                            {item.unitName}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>
                          {item.safetyStock.toLocaleString("zh-CN")}{" "}
                          {item.unitName}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <strong className="deficit-highlight">
                            +{item.suggestedQty} {item.unitName}
                          </strong>
                        </td>
                        <td
                          style={{ textAlign: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            min="1"
                            className="order-qty-input"
                            value={qtyVal}
                            onChange={(e) =>
                              handleQtyChange(item.productId, e.target.value)
                            }
                          />
                        </td>
                        <td style={{ textAlign: "right", color: "#475569" }}>
                          ¥{Number(item.defaultPurchasePrice).toFixed(2)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 600,
                            color: "#0f172a",
                          }}
                        >
                          ¥{lineSubtotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="low-stock-empty">
                        <Package size={36} />
                        <p>
                          太棒了！当前仓库所有商品库存充足，均在安全库存线以上。
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {error && <div className="low-stock-error-msg">{error}</div>}

            {/* Bottom Actions & One-Click Restock */}
            <footer className="low-stock-footer">
              <div className="low-stock-footer-info">
                <span>
                  已勾选 <b>{selectedItems.length}</b> 种预警商品
                </span>
                <span>
                  预计采购金额:{" "}
                  <strong className="footer-total-price">
                    ¥
                    {totalEstimatedCost.toLocaleString("zh-CN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </span>
              </div>

              <div className="low-stock-footer-btns">
                <button
                  type="button"
                  className="outline-button"
                  onClick={onClose}
                >
                  关闭
                </button>
                <button
                  type="button"
                  className="primary-button restock-submit-btn"
                  disabled={selectedItems.length === 0 || isSubmitting}
                  onClick={handleCreatePurchaseDraft}
                >
                  <ShoppingCart size={16} />
                  {isSubmitting
                    ? "正在生成采购草稿..."
                    : `一键生成采购进货单 (${selectedItems.length})`}
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
