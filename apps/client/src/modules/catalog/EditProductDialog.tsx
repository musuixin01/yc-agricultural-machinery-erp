import { useEffect, useRef, useState, type FormEvent } from "react";
import { Info, PencilLine, X } from "lucide-react";
import type { Product, ProductType } from "./catalog-api";
import { useCatalogReferences, useUpdateProduct } from "./use-catalog";

export function EditProductDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const references = useCatalogReferences(Boolean(product));
  const update = useUpdateProduct();
  const nameRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!product) return;
    setError("");
    const timer = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [product]);

  if (!product) return null;
  const currentProduct = product;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const barcode = String(data.get("barcode") ?? "").trim();
    const secondaryBarcodes = currentProduct.barcodes
      .filter((item) => !item.isPrimary)
      .map((item) => ({ barcode: item.barcode, isPrimary: false }));
    try {
      await update.mutateAsync({
        product: currentProduct,
        input: {
          version: currentProduct.version,
          code: String(data.get("code") ?? "").trim(),
          name: String(data.get("name") ?? "").trim(),
          mnemonicCode:
            String(data.get("mnemonicCode") ?? "").trim() || undefined,
          type: data.get("type") as ProductType,
          categoryId: String(data.get("categoryId")),
          baseUnitId: String(data.get("baseUnitId")),
          brandId: String(data.get("brandId") || "") || undefined,
          model: String(data.get("model") ?? "").trim() || undefined,
          specification:
            String(data.get("specification") ?? "").trim() || undefined,
          retailPrice: String(data.get("retailPrice") || "0"),
          wholesalePrice: String(data.get("wholesalePrice") || "0"),
          defaultPurchasePrice: String(data.get("defaultPurchasePrice") || "0"),
          minimumSalePrice: String(data.get("minimumSalePrice") || "0"),
          safetyStock: String(data.get("safetyStock") || "0"),
          barcodes: barcode
            ? [{ barcode, isPrimary: true }, ...secondaryBarcodes]
            : secondaryBarcodes,
        },
      });
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
        className="catalog-dialog catalog-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-product-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>商品资料 · {product.code}</small>
            <h2 id="edit-product-title">编辑商品</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        {references.isLoading ? (
          <div className="catalog-state">正在加载基础资料…</div>
        ) : references.isError ? (
          <div className="catalog-state error">
            基础资料加载失败，请稍后重试。
          </div>
        ) : (
          <form key={`${product.id}-${product.version}`} onSubmit={submit}>
            <div className="catalog-edit-note">
              <Info />
              <span>
                这里修改商品资料，不会改动库存数量，也不会改写以前的销售、采购单据。
              </span>
            </div>
            <div className="catalog-form-row">
              <label>
                <span>商品名称 *</span>
                <input
                  ref={nameRef}
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={product.name}
                />
              </label>
              <label>
                <span>商品编码 *</span>
                <input
                  name="code"
                  required
                  minLength={2}
                  maxLength={48}
                  defaultValue={product.code}
                />
              </label>
            </div>
            <div className="catalog-form-row">
              <label>
                <span>商品类型 *</span>
                <select name="type" defaultValue={product.type}>
                  <option value="MACHINE">整机</option>
                  <option value="PART">农机配件</option>
                  <option value="STANDARD_PART">标准件/螺丝</option>
                  <option value="CONSUMABLE">耗材</option>
                  <option value="SERVICE">服务</option>
                </select>
              </label>
              <label>
                <span>分类 *</span>
                <select
                  name="categoryId"
                  required
                  defaultValue={product.category.id}
                >
                  {references.data?.categories.map((item) => (
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
                <select
                  name="baseUnitId"
                  required
                  defaultValue={product.baseUnit.id}
                >
                  {references.data?.units.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>品牌</span>
                <select name="brandId" defaultValue={product.brand?.id ?? ""}>
                  <option value="">无品牌</option>
                  {references.data?.brands.map((item) => (
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
                <input
                  name="model"
                  maxLength={120}
                  defaultValue={product.model ?? ""}
                />
              </label>
              <label>
                <span>规格</span>
                <input
                  name="specification"
                  maxLength={240}
                  defaultValue={product.specification ?? ""}
                />
              </label>
            </div>
            <div className="catalog-form-row">
              <label>
                <span>零售价（元）</span>
                <input
                  name="retailPrice"
                  inputMode="decimal"
                  required
                  pattern="\d{1,15}(\.\d{1,4})?"
                  defaultValue={product.retailPrice}
                />
              </label>
              <label>
                <span>批发价（元）</span>
                <input
                  name="wholesalePrice"
                  inputMode="decimal"
                  required
                  pattern="\d{1,15}(\.\d{1,4})?"
                  defaultValue={product.wholesalePrice}
                />
              </label>
            </div>
            <div className="catalog-form-row">
              <label>
                <span>默认进价（元）</span>
                <input
                  name="defaultPurchasePrice"
                  inputMode="decimal"
                  required
                  pattern="\d{1,15}(\.\d{1,4})?"
                  defaultValue={product.defaultPurchasePrice}
                />
              </label>
              <label>
                <span>最低售价（元）</span>
                <input
                  name="minimumSalePrice"
                  inputMode="decimal"
                  required
                  pattern="\d{1,15}(\.\d{1,4})?"
                  defaultValue={product.minimumSalePrice}
                />
              </label>
            </div>
            <div className="catalog-form-row">
              <label>
                <span>安全库存</span>
                <input
                  name="safetyStock"
                  inputMode="decimal"
                  required
                  pattern="\d{1,12}(\.\d{1,6})?"
                  defaultValue={product.safetyStock}
                />
              </label>
              <label>
                <span>主条码</span>
                <input
                  name="barcode"
                  maxLength={64}
                  defaultValue={
                    product.barcodes.find((item) => item.isPrimary)?.barcode ??
                    product.barcodes[0]?.barcode ??
                    ""
                  }
                  placeholder="可使用扫码枪录入"
                />
              </label>
            </div>
            <label>
              <span>助记码</span>
              <input
                name="mnemonicCode"
                maxLength={64}
                defaultValue={product.mnemonicCode ?? ""}
                placeholder="用于快速搜索，可不填"
              />
            </label>
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
              <button className="primary-button" disabled={update.isPending}>
                <PencilLine size={16} />
                {update.isPending ? "正在保存…" : "保存修改"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
