import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useCreateWarehouse } from "./use-warehouses";

export function CreateWarehouseDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateWarehouse();
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) setError("");
  }, [open]);
  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const locationCode = String(data.get("locationCode") || "").trim();
    const locationName = String(data.get("locationName") || "").trim();
    if ((locationCode && !locationName) || (!locationCode && locationName)) {
      setError("库位编码和库位名称需要同时填写。");
      return;
    }
    try {
      await create.mutateAsync({
        code: String(data.get("code")),
        name: String(data.get("name")),
        address: String(data.get("address") || "") || undefined,
        notes: String(data.get("notes") || "") || undefined,
        isDefault: Boolean(data.get("isDefault")),
        locations: locationCode
          ? [
              {
                code: locationCode,
                name: locationName,
                description:
                  String(data.get("locationDescription") || "") || undefined,
              },
            ]
          : undefined,
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
        className="catalog-dialog warehouse-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-warehouse-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>库存基础资料</small>
            <h2 id="new-warehouse-title">新增仓库</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="catalog-form-row">
            <label>
              <span>仓库编码 *</span>
              <input
                name="code"
                required
                minLength={2}
                maxLength={32}
                placeholder="如 YC-ZC"
                autoFocus
              />
            </label>
            <label>
              <span>仓库名称 *</span>
              <input
                name="name"
                required
                maxLength={100}
                placeholder="如 玉春主仓"
              />
            </label>
          </div>
          <label>
            <span>仓库地址</span>
            <input
              name="address"
              maxLength={240}
              placeholder="门店、院落或具体地址"
            />
          </label>
          <label className="warehouse-default-check">
            <input type="checkbox" name="isDefault" />
            <span>设为默认仓库（开单时优先选择）</span>
          </label>
          <div className="party-form-divider">首个库位（可选）</div>
          <div className="catalog-form-row">
            <label>
              <span>库位编码</span>
              <input name="locationCode" maxLength={32} placeholder="如 A-01" />
            </label>
            <label>
              <span>库位名称</span>
              <input
                name="locationName"
                maxLength={100}
                placeholder="如 螺丝一区"
              />
            </label>
          </div>
          <label>
            <span>库位说明</span>
            <input
              name="locationDescription"
              maxLength={240}
              placeholder="货架、区域或存放品类"
            />
          </label>
          <label>
            <span>仓库备注</span>
            <input name="notes" maxLength={500} />
          </label>
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
              {create.isPending ? "正在保存…" : "保存仓库"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
