import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PackageX,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useWarehouses } from "../warehouses/use-warehouses";
import type {
  InventoryDamageDocument,
  InventoryDamageInput,
  InventoryDamageReason,
} from "./inventory-api";
import {
  useCreateInventoryDamage,
  useInventoryBalances,
  usePostInventoryDamage,
  useSubmitInventoryDamage,
  useUpdateInventoryDamage,
} from "./use-inventory";

type DamageLineDraft = {
  productId: string;
  name: string;
  code: string;
  unitName: string;
  quantity: string;
  reason: InventoryDamageReason;
  reasonDetail: string;
};

const reasonLabels: Record<InventoryDamageReason, string> = {
  DAMAGED: "损坏",
  RUSTED: "锈蚀",
  OBSOLETE: "淘汰 / 无法销售",
  OTHER: "其他",
};

export function InventoryDamageDialog({
  open,
  document,
  onChange,
  onClose,
}: {
  open: boolean;
  document: InventoryDamageDocument | null;
  onChange: (document: InventoryDamageDocument) => void;
  onClose: () => void;
}) {
  const warehouses = useWarehouses("", "ACTIVE");
  const balances = useInventoryBalances();
  const create = useCreateInventoryDamage();
  const update = useUpdateInventoryDamage();
  const submit = useSubmitInventoryDamage();
  const post = usePostInventoryDamage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const initializedKey = useRef("");
  const [warehouseId, setWarehouseId] = useState("");
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<DamageLineDraft[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      initializedKey.current = "";
      return;
    }
    if (!document && !warehouses.data) return;
    const key = document?.id ?? "new";
    if (initializedKey.current === key) return;
    initializedKey.current = key;
    setError("");
    setSearch("");
    if (document) {
      setWarehouseId(document.warehouse.id);
      setBusinessDate(document.businessDate);
      setNotes(document.notes ?? "");
      setLines(
        document.lines.map((line) => ({
          productId: line.product.id,
          name: line.productNameSnapshot,
          code: line.product.code,
          unitName: line.unitNameSnapshot,
          quantity: line.quantity,
          reason: line.reason,
          reasonDetail: line.reasonDetail ?? "",
        })),
      );
    } else {
      const defaultWarehouse =
        warehouses.data?.items.find((item) => item.isDefault)?.id ??
        warehouses.data?.items[0]?.id ??
        "";
      setWarehouseId(defaultWarehouse);
      setBusinessDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setLines([]);
    }
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [document, open, warehouses.data]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!open) return;
    const returnFocus = globalThis.document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && globalThis.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        globalThis.document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [onClose, open]);

  const currentBalances = useMemo(
    () =>
      (balances.data?.items ?? []).filter(
        (item) =>
          item.warehouse.id === warehouseId && Number(item.quantity) > 0,
      ),
    [balances.data, warehouseId],
  );
  const balanceByProduct = useMemo(
    () => new Map(currentBalances.map((item) => [item.product.id, item])),
    [currentBalances],
  );
  const searchResults = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return [];
    return currentBalances
      .filter(
        (item) =>
          !lines.some((line) => line.productId === item.product.id) &&
          (item.product.name.toLowerCase().includes(keyword) ||
            item.product.code.toLowerCase().includes(keyword)),
      )
      .slice(0, 6);
  }, [currentBalances, lines, search]);
  const readOnly =
    document?.status === "SUBMITTED" || document?.status === "POSTED";
  const pending =
    create.isPending || update.isPending || submit.isPending || post.isPending;

  if (!open) return null;

  function addLine(productId: string) {
    const balance = balanceByProduct.get(productId);
    if (!balance) return;
    setLines((current) => [
      ...current,
      {
        productId,
        name: balance.product.name,
        code: balance.product.code,
        unitName: balance.product.unitName,
        quantity: "1",
        reason: "DAMAGED",
        reasonDetail: "",
      },
    ]);
    setSearch("");
    searchRef.current?.focus();
  }

  function patchLine(index: number, patch: Partial<DamageLineDraft>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  function buildInput(): InventoryDamageInput | null {
    setError("");
    if (!warehouseId) {
      setError("请选择报损仓库。");
      return null;
    }
    if (lines.length === 0) {
      setError("请先搜索并添加至少一种报损商品。");
      return null;
    }
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const available = Number(
        balanceByProduct.get(line.productId)?.quantity ?? 0,
      );
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(`${line.name} 的报损数量必须大于零。`);
        return null;
      }
      if (!document || document.status !== "POSTED") {
        if (quantity > available) {
          setError(
            `${line.name} 当前只有 ${available} ${line.unitName}，报损数量不能超过库存。`,
          );
          return null;
        }
      }
      if (line.reason === "OTHER" && !line.reasonDetail.trim()) {
        setError(`${line.name} 选择了“其他”，请填写具体原因。`);
        return null;
      }
    }
    return {
      warehouseId,
      businessDate,
      notes: notes.trim() || undefined,
      lines: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        reason: line.reason,
        reasonDetail: line.reasonDetail.trim() || undefined,
      })),
    };
  }

  async function saveDraft(andSubmit: boolean) {
    const input = buildInput();
    if (!input) return;
    try {
      const saved = document
        ? await update.mutateAsync({ document, input })
        : await create.mutateAsync(input);
      const result = andSubmit ? await submit.mutateAsync(saved) : saved;
      onChange(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "报损单保存失败");
    }
  }

  async function postDocument() {
    if (!document) return;
    if (
      !window.confirm(
        "正式过账后将立即扣减可销售库存，并生成不可修改的报损流水。确认继续吗？",
      )
    )
      return;
    setError("");
    try {
      onChange(await post.mutateAsync(document));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "报损过账失败");
    }
  }

  function changeWarehouse(next: string) {
    if (
      lines.length &&
      !window.confirm("更换仓库会清空已添加的报损商品，是否继续？")
    )
      return;
    setWarehouseId(next);
    setLines([]);
    setSearch("");
  }

  return (
    <div className="catalog-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="catalog-dialog damage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="damage-dialog-title"
      >
        <header>
          <div>
            <small>{document?.documentNumber ?? "正式库存减少"}</small>
            <h2 id="damage-dialog-title">库存报损</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭报损窗口">
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          className="damage-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!readOnly) void saveDraft(true);
          }}
        >
          <div className="damage-heading-row">
            <div className="damage-intro">
              <PackageX aria-hidden="true" />
              <div>
                <strong>只用于确实损坏、锈蚀或无法销售的商品</strong>
                <span>数量盘错请使用库存盘点；客户退货请使用销售退货。</span>
              </div>
            </div>
            {document && (
              <span
                className={`ledger-status ${document.status.toLowerCase()}`}
              >
                {document.status === "DRAFT"
                  ? "草稿"
                  : document.status === "SUBMITTED"
                    ? "待过账"
                    : "已过账"}
              </span>
            )}
          </div>

          <div className="catalog-form-row">
            <label htmlFor="damage-warehouse">
              <span>报损仓库 *</span>
              <select
                id="damage-warehouse"
                value={warehouseId}
                onChange={(event) => changeWarehouse(event.target.value)}
                disabled={readOnly}
                required
              >
                <option value="">请选择仓库</option>
                {warehouses.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="damage-date">
              <span>报损日期 *</span>
              <input
                id="damage-date"
                type="date"
                value={businessDate}
                onChange={(event) => setBusinessDate(event.target.value)}
                disabled={readOnly}
                required
              />
            </label>
          </div>

          {!readOnly && (
            <div className="damage-product-search">
              <label htmlFor="damage-product-search">
                <span>搜索商品</span>
                <span className="damage-search-input">
                  <Search aria-hidden="true" />
                  <input
                    id="damage-product-search"
                    ref={searchRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="输入商品名称或编号"
                    autoComplete="off"
                  />
                </span>
              </label>
              {search.trim() && (
                <div className="damage-search-results">
                  {searchResults.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => addLine(item.product.id)}
                    >
                      <span>
                        <b>{item.product.name}</b>
                        <small>{item.product.code}</small>
                      </span>
                      <span>
                        可报损 {Number(item.quantity).toLocaleString("zh-CN")}{" "}
                        {item.product.unitName}
                      </span>
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <div>没有找到该仓库中有库存且尚未添加的商品。</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="damage-lines">
            {lines.map((line, index) => {
              const balance = balanceByProduct.get(line.productId);
              return (
                <article key={line.productId} className="damage-line">
                  <div className="damage-product">
                    <span>{line.name.slice(0, 1)}</span>
                    <div>
                      <b>{line.name}</b>
                      <small>
                        {line.code} · 当前{" "}
                        {Number(balance?.quantity ?? 0).toLocaleString("zh-CN")}{" "}
                        {line.unitName}
                      </small>
                    </div>
                  </div>
                  <label htmlFor={`damage-quantity-${line.productId}`}>
                    <span>报损数量</span>
                    <input
                      id={`damage-quantity-${line.productId}`}
                      value={line.quantity}
                      onChange={(event) =>
                        patchLine(index, { quantity: event.target.value })
                      }
                      inputMode="decimal"
                      pattern="\d{1,13}(\.\d{1,6})?"
                      disabled={readOnly}
                      required
                    />
                  </label>
                  <label htmlFor={`damage-reason-${line.productId}`}>
                    <span>报损原因</span>
                    <select
                      id={`damage-reason-${line.productId}`}
                      value={line.reason}
                      onChange={(event) =>
                        patchLine(index, {
                          reason: event.target.value as InventoryDamageReason,
                        })
                      }
                      disabled={readOnly}
                    >
                      {Object.entries(reasonLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor={`damage-detail-${line.productId}`}>
                    <span>具体说明{line.reason === "OTHER" ? " *" : ""}</span>
                    <input
                      id={`damage-detail-${line.productId}`}
                      value={line.reasonDetail}
                      onChange={(event) =>
                        patchLine(index, { reasonDetail: event.target.value })
                      }
                      maxLength={240}
                      placeholder="可填写损坏位置或处理情况"
                      disabled={readOnly}
                    />
                  </label>
                  {!readOnly && (
                    <button
                      type="button"
                      className="damage-remove"
                      onClick={() =>
                        setLines((current) =>
                          current.filter((_, lineIndex) => lineIndex !== index),
                        )
                      }
                      aria-label={`移除 ${line.name}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  )}
                </article>
              );
            })}
            {lines.length === 0 && (
              <div className="damage-empty">
                <PackageX aria-hidden="true" />
                <strong>还没有报损商品</strong>
                <span>在上方搜索商品名称或编号后添加。</span>
              </div>
            )}
          </div>

          <label htmlFor="damage-notes">
            <span>整单备注（可选）</span>
            <input
              id="damage-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              placeholder="例如：仓库整理时集中发现"
              disabled={readOnly}
            />
          </label>

          {document?.status === "SUBMITTED" && (
            <div className="damage-review-note">
              <AlertTriangle aria-hidden="true" />
              正式过账会按当前移动平均成本扣减库存；库存不足时整单不会生效。
            </div>
          )}
          {document?.status === "POSTED" && (
            <div className="damage-posted-note">
              <CheckCircle2 aria-hidden="true" />
              <span>
                已扣减库存并生成正式报损流水，报损成本
                <b>
                  {" "}
                  ¥
                  {Number(document.totalCost).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                  })}
                </b>
              </span>
            </div>
          )}
          {error && (
            <p
              ref={errorRef}
              className="catalog-form-error"
              role="alert"
              tabIndex={-1}
            >
              {error}
            </p>
          )}

          <footer className="damage-actions">
            <button type="button" className="outline-button" onClick={onClose}>
              关闭
            </button>
            {!readOnly && (
              <>
                <button
                  type="button"
                  className="outline-button"
                  disabled={pending}
                  onClick={() => void saveDraft(false)}
                >
                  保存草稿
                </button>
                <button className="primary-button" disabled={pending}>
                  {pending ? "正在保存…" : "保存并提交复核"}
                </button>
              </>
            )}
            {document?.status === "SUBMITTED" && (
              <button
                type="button"
                className="primary-button"
                disabled={pending}
                onClick={() => void postDocument()}
              >
                {post.isPending ? "正在过账…" : "确认并正式过账"}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
