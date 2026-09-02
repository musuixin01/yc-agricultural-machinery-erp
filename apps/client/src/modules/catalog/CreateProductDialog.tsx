import { useEffect, useState, type FormEvent } from "react";
import { PackagePlus, X } from "lucide-react";
import { useAuth } from "../auth/AuthGate";
import { useCreateInitialStock } from "../inventory/use-inventory";
import { useWarehouses } from "../warehouses/use-warehouses";
import type { Product, ProductType } from "./catalog-api";
import { useCatalogReferences, useCreateProduct } from "./use-catalog";

const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
};

export function CreateProductDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const auth = useAuth();
  const canCreateStock = auth.user.permissions.includes("inventory.post");
  const refs = useCatalogReferences(open);
  const warehouses = useWarehouses("", "ACTIVE");
  const create = useCreateProduct();
  const createInitialStock = useCreateInitialStock();
  const [productType, setProductType] = useState<ProductType>("PART");
  const [warehouseId, setWarehouseId] = useState("");
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setSavedProduct(null);
      setProductType("PART");
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (!warehouseId && warehouses.data?.items.length)
      setWarehouseId(
        warehouses.data.items.find((item) => item.isDefault)?.id ??
          warehouses.data.items[0].id,
      );
  }, [open, warehouseId, warehouses.data]);
  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const quantity = String(data.get("currentStock") || "0");
    let productWasSaved = Boolean(savedProduct);
    try {
      let product = savedProduct;
      if (!product) {
        const barcode = String(data.get("barcode") ?? "").trim();
        product = await create.mutateAsync({
          code: String(data.get("code")),
          name: String(data.get("name")),
          type: data.get("type") as ProductType,
          categoryId: String(data.get("categoryId")),
          baseUnitId: String(data.get("baseUnitId")),
          brandId: String(data.get("brandId") || "") || undefined,
          model: String(data.get("model") || "") || undefined,
          specification: String(data.get("specification") || "") || undefined,
          retailPrice: String(data.get("retailPrice") || "0"),
          safetyStock: String(data.get("safetyStock") || "0"),
          barcodes: barcode ? [{ barcode, isPrimary: true }] : undefined,
        });
        productWasSaved = true;
      }

      if (canCreateStock && productType !== "SERVICE" && Number(quantity) > 0) {
        setSavedProduct(product);
        await createInitialStock.mutateAsync({
          productId: product.id,
          warehouseId,
          businessDate: String(data.get("stockDate")),
          quantity,
          unitCost: String(data.get("unitCost") || "0"),
        });
      }
      onClose();
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "保存失败，请稍后重试";
      setError(
        productWasSaved
          ? `商品已经保存，但库存建立失败：${message}。请核对库存信息后重试。`
          : message,
      );
    }
  }

  const stockEnabled = canCreateStock && productType !== "SERVICE";
  const pending = create.isPending || createInitialStock.isPending;

  return (
    <div
      className="catalog-dialog-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="catalog-dialog product-stock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-product-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>商品与库存</small>
            <h2 id="new-product-title">新增商品</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        {refs.isLoading || warehouses.isLoading ? (
          <div className="catalog-state">正在加载基础资料…</div>
        ) : refs.isError || warehouses.isError ? (
          <div className="catalog-state error">
            基础资料加载失败，请确认服务已启动。
          </div>
        ) : (
          <form onSubmit={submit}>
            {savedProduct ? (
              <div className="catalog-product-saved">
                <PackagePlus />
                <div>
                  <strong>{savedProduct.name} 已经建档</strong>
                  <span>现在只需核对下面的库存信息并重新提交。</span>
                </div>
              </div>
            ) : (
              <>
                <div className="catalog-form-row">
                  <label>
                    <span>商品编码 *</span>
                    <input
                      name="code"
                      required
                      minLength={2}
                      maxLength={48}
                      placeholder="如 LS-M12-045"
                      autoFocus
                    />
                  </label>
                  <label>
                    <span>商品名称 *</span>
                    <input
                      name="name"
                      required
                      maxLength={160}
                      placeholder="如 高强度螺栓 M12×45"
                    />
                  </label>
                </div>
                <div className="catalog-form-row">
                  <label>
                    <span>商品类型 *</span>
                    <select
                      name="type"
                      value={productType}
                      onChange={(event) =>
                        setProductType(event.target.value as ProductType)
                      }
                    >
                      <option value="MACHINE">整机</option>
                      <option value="PART">农机配件</option>
                      <option value="STANDARD_PART">标准件/螺丝</option>
                      <option value="CONSUMABLE">耗材</option>
                      <option value="SERVICE">服务</option>
                    </select>
                  </label>
                  <label>
                    <span>分类 *</span>
                    <select name="categoryId" required>
                      {refs.data?.categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="catalog-form-row">
                  <label>
                    <span>基本单位 *</span>
                    <select name="baseUnitId" required>
                      {refs.data?.units.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>品牌</span>
                    <select name="brandId">
                      <option value="">无品牌</option>
                      {refs.data?.brands.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="catalog-form-row">
                  <label>
                    <span>型号</span>
                    <input name="model" maxLength={120} />
                  </label>
                  <label>
                    <span>规格</span>
                    <input name="specification" maxLength={240} />
                  </label>
                </div>
                <div className="catalog-form-row">
                  <label>
                    <span>零售价（元）</span>
                    <input
                      name="retailPrice"
                      inputMode="decimal"
                      defaultValue="0"
                      pattern="\d{1,15}(\.\d{1,4})?"
                    />
                  </label>
                  <label>
                    <span>安全库存</span>
                    <input
                      name="safetyStock"
                      inputMode="decimal"
                      defaultValue="0"
                      pattern="\d{1,12}(\.\d{1,6})?"
                    />
                  </label>
                </div>
                <label>
                  <span>主条码</span>
                  <input
                    name="barcode"
                    maxLength={64}
                    placeholder="可使用扫码枪录入"
                  />
                </label>
              </>
            )}

            {stockEnabled && (
              <fieldset className="catalog-stock-fields">
                <legend>当前库存</legend>
                <small>有现货直接填写；没有现货填 0，以后通过采购入库。</small>
                <div className="catalog-form-row">
                  <label>
                    <span>当前数量</span>
                    <input
                      name="currentStock"
                      inputMode="decimal"
                      defaultValue="0"
                      pattern="\d{1,13}(\.\d{1,6})?"
                    />
                  </label>
                  <label>
                    <span>单位成本（元）</span>
                    <input
                      name="unitCost"
                      inputMode="decimal"
                      defaultValue="0"
                      pattern="\d{1,15}(\.\d{1,4})?"
                    />
                  </label>
                </div>
                <div className="catalog-form-row">
                  <label>
                    <span>存放仓库 *</span>
                    <select
                      name="warehouseId"
                      value={warehouseId}
                      onChange={(event) => setWarehouseId(event.target.value)}
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
                    <span>库存日期 *</span>
                    <input
                      name="stockDate"
                      type="date"
                      defaultValue={localDate()}
                      required
                    />
                  </label>
                </div>
              </fieldset>
            )}
            {!canCreateStock && productType !== "SERVICE" && (
              <p className="catalog-stock-permission">
                当前账号可以建立商品，但没有库存入账权限；库存需由老板或库管处理。
              </p>
            )}
            {error && (
              <p className="catalog-form-error" role="alert">
                {error}
              </p>
            )}
            <footer>
              <button
                type="button"
                className="outline-button"
                onClick={onClose}
              >
                取消
              </button>
              <button className="primary-button" disabled={pending}>
                {pending
                  ? "正在保存商品和库存…"
                  : savedProduct
                    ? "重试建立库存"
                    : stockEnabled
                      ? "保存商品和库存"
                      : "保存商品"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
