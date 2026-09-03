import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Package,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useWarehouses } from "../warehouses/use-warehouses";
import type {
  CreateTransferInput,
  InventoryTransferDocument,
} from "./inventory-api";
import {
  useCreateInventoryTransfer,
  useInventoryBalances,
  usePostInventoryTransfer,
  useSubmitInventoryTransfer,
  useUpdateInventoryTransfer,
} from "./use-inventory";

type TransferLineDraft = {
  productId: string;
  name: string;
  code: string;
  unitName: string;
  quantity: string;
  unitCost: string;
};

export function TransferDialog({
  open,
  document,
  onChange,
  onClose,
}: {
  open: boolean;
  document: InventoryTransferDocument | null;
  onChange: (document: InventoryTransferDocument) => void;
  onClose: () => void;
}) {
  const warehouses = useWarehouses("", "ACTIVE");
  const balances = useInventoryBalances();
  const create = useCreateInventoryTransfer();
  const update = useUpdateInventoryTransfer();
  const submit = useSubmitInventoryTransfer();
  const post = usePostInventoryTransfer();

  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const initializedKey = useRef("");

  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<TransferLineDraft[]>([]);
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
      setSourceWarehouseId(document.sourceWarehouse.id);
      setTargetWarehouseId(document.targetWarehouse.id);
      setBusinessDate(document.businessDate);
      setNotes(document.notes ?? "");
      setLines(
        document.lines.map((line) => ({
          productId: line.product.id,
          name: line.productNameSnapshot,
          code: line.product.code,
          unitName: line.unitNameSnapshot,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      );
    } else {
      const items = warehouses.data?.items ?? [];
      const defaultWh =
        items.find((w) => w.isDefault)?.id ?? items[0]?.id ?? "";
      const otherWh = items.find((w) => w.id !== defaultWh)?.id ?? "";
      setSourceWarehouseId(defaultWh);
      setTargetWarehouseId(otherWh);
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

  // Balances in the source warehouse
  const sourceBalances = useMemo(
    () =>
      (balances.data?.items ?? []).filter(
        (item) =>
          item.warehouse.id === sourceWarehouseId && Number(item.quantity) > 0,
      ),
    [balances.data, sourceWarehouseId],
  );

  const balanceByProduct = useMemo(
    () => new Map(sourceBalances.map((item) => [item.product.id, item])),
    [sourceBalances],
  );

  const searchResults = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return [];
    return sourceBalances
      .filter(
        (item) =>
          !lines.some((line) => line.productId === item.product.id) &&
          (item.product.name.toLowerCase().includes(keyword) ||
            item.product.code.toLowerCase().includes(keyword)),
      )
      .slice(0, 6);
  }, [sourceBalances, lines, search]);

  const readOnly =
    document?.status === "SUBMITTED" || document?.status === "POSTED";
  const pending =
    create.isPending || update.isPending || submit.isPending || post.isPending;

  const totalTransferCost = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum + Number(line.quantity || 0) * Number(line.unitCost || 0),
        0,
      ),
    [lines],
  );

  const totalTransferQty = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
    [lines],
  );

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
        unitCost: balance.averageCost || "0.00",
      },
    ]);
    setSearch("");
    searchRef.current?.focus();
  }

  function patchLine(index: number, patch: Partial<TransferLineDraft>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  function buildInput(): CreateTransferInput | null {
    setError("");
    if (!sourceWarehouseId) {
      setError("请选择调出仓库。");
      return null;
    }
    if (!targetWarehouseId) {
      setError("请选择调入仓库。");
      return null;
    }
    if (sourceWarehouseId === targetWarehouseId) {
      setError("调出仓库与调入仓库不能相同，请选择不同的目标仓库。");
      return null;
    }
    if (lines.length === 0) {
      setError("请先搜索并添加至少一种要调拨的商品。");
      return null;
    }
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const available = Number(
        balanceByProduct.get(line.productId)?.quantity ?? 0,
      );
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(`${line.name} 的调拨数量必须大于零。`);
        return null;
      }
      if (!document || document.status !== "POSTED") {
        if (quantity > available) {
          setError(
            `${line.name} 调出仓库仅有 ${available} ${line.unitName}，调拨数量不能超过现有库存。`,
          );
          return null;
        }
      }
    }
    return {
      sourceWarehouseId,
      targetWarehouseId,
      businessDate,
      notes: notes.trim() || undefined,
      lines: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
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
      setError(reason instanceof Error ? reason.message : "调拨单保存失败");
    }
  }

  async function postDocument() {
    if (!document) return;
    if (
      !window.confirm(
        "正式过账后将自动扣减调出仓库库存并增加调入仓库库存，生成不可修改的调拨流水。确认继续吗？",
      )
    )
      return;
    setError("");
    try {
      onChange(await post.mutateAsync(document));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "调拨过账失败");
    }
  }

  function changeSourceWarehouse(next: string) {
    if (
      lines.length &&
      !window.confirm("更换调出仓库会清空已添加的调拨商品，是否继续？")
    )
      return;
    setSourceWarehouseId(next);
    setLines([]);
    setSearch("");
  }

  return (
    <div className="catalog-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="catalog-dialog transfer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-dialog-title"
      >
        <header>
          <div>
            <small>{document?.documentNumber ?? "跨仓库库存调动"}</small>
            <h2 id="transfer-dialog-title">库存调拨</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭调拨窗口">
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          className="transfer-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!readOnly) void saveDraft(true);
          }}
        >
          <div className="transfer-heading-row">
            <div className="transfer-intro">
              <ArrowRightLeft aria-hidden="true" />
              <div>
                <strong>仓库间商品移库调拨</strong>
                <span>
                  过账后自动完成调出仓库出库与调入仓库入库，保证账实一致。
                </span>
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

          <div className="transfer-warehouses-row">
            <label htmlFor="transfer-source-wh">
              <span>调出仓库（出库方） *</span>
              <select
                id="transfer-source-wh"
                value={sourceWarehouseId}
                onChange={(event) => changeSourceWarehouse(event.target.value)}
                disabled={readOnly}
                required
              >
                <option value="">请选择调出仓库</option>
                {warehouses.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.isDefault ? "(默认)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="transfer-arrow" aria-hidden="true">
              →
            </div>

            <label htmlFor="transfer-target-wh">
              <span>调入仓库（接收方） *</span>
              <select
                id="transfer-target-wh"
                value={targetWarehouseId}
                onChange={(event) => setTargetWarehouseId(event.target.value)}
                disabled={readOnly}
                required
              >
                <option value="">请选择调入仓库</option>
                {warehouses.data?.items.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={item.id === sourceWarehouseId}
                  >
                    {item.name}{" "}
                    {item.id === sourceWarehouseId ? "(不可同仓)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="transfer-date">
              <span>调拨日期 *</span>
              <input
                id="transfer-date"
                type="date"
                value={businessDate}
                onChange={(event) => setBusinessDate(event.target.value)}
                disabled={readOnly}
                required
              />
            </label>
          </div>

          {!readOnly && (
            <div className="transfer-product-search">
              <label htmlFor="transfer-product-search">
                <span>搜索调出仓库中的商品</span>
                <span className="transfer-search-input">
                  <Search aria-hidden="true" />
                  <input
                    id="transfer-product-search"
                    ref={searchRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="输入商品名称或编号进行添加"
                    autoComplete="off"
                  />
                </span>
              </label>
              {search.trim() && (
                <div className="transfer-search-results">
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
                        可用库存 {Number(item.quantity).toLocaleString("zh-CN")}{" "}
                        {item.product.unitName} · 均价 ¥
                        {Number(item.averageCost).toFixed(2)}
                      </span>
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="transfer-no-result">
                      没有在调出仓库中找到符合条件且尚未添加的库存商品。
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="transfer-lines">
            {lines.map((line, index) => {
              const balance = balanceByProduct.get(line.productId);
              const available = Number(balance?.quantity ?? 0);
              const lineTotal =
                Number(line.quantity || 0) * Number(line.unitCost || 0);

              return (
                <article key={line.productId} className="transfer-line">
                  <div className="transfer-product">
                    <span className="transfer-avatar">
                      <Package aria-hidden="true" size={18} />
                    </span>
                    <div>
                      <b>{line.name}</b>
                      <small>
                        {line.code} · 当前调出仓存{" "}
                        {available.toLocaleString("zh-CN")} {line.unitName}
                      </small>
                    </div>
                  </div>

                  <label htmlFor={`transfer-qty-${line.productId}`}>
                    <span>调拨数量</span>
                    <input
                      id={`transfer-qty-${line.productId}`}
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

                  <label htmlFor={`transfer-cost-${line.productId}`}>
                    <span>单位成本 (元)</span>
                    <input
                      id={`transfer-cost-${line.productId}`}
                      value={line.unitCost}
                      onChange={(event) =>
                        patchLine(index, { unitCost: event.target.value })
                      }
                      inputMode="decimal"
                      disabled={readOnly}
                      required
                    />
                  </label>

                  <div className="transfer-line-subtotal">
                    <span>小计成本</span>
                    <strong>
                      ¥
                      {lineTotal.toLocaleString("zh-CN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </div>

                  {!readOnly && (
                    <button
                      type="button"
                      className="transfer-remove"
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
              <div className="transfer-empty">
                <ArrowRightLeft aria-hidden="true" />
                <strong>暂未选择调拨商品</strong>
                <span>
                  请在上方搜索框输入商品名称或编码并点击加入调拨清单。
                </span>
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="transfer-summary-bar">
              <span>
                共 <b>{lines.length}</b> 种商品
              </span>
              <span>
                调拨总量: <b>{totalTransferQty.toLocaleString("zh-CN")}</b>
              </span>
              <span>
                调拨总成本:{" "}
                <b>
                  ¥
                  {totalTransferCost.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </b>
              </span>
            </div>
          )}

          <label htmlFor="transfer-notes">
            <span>整单备注（可选）</span>
            <input
              id="transfer-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              placeholder="例如：主库向配件专柜备货"
              disabled={readOnly}
            />
          </label>

          {document?.status === "SUBMITTED" && (
            <div className="transfer-review-note">
              <AlertTriangle aria-hidden="true" />
              正式过账将自动完成调出仓与调入仓库存增减并生成调拨流水。
            </div>
          )}

          {document?.status === "POSTED" && (
            <div className="transfer-posted-note">
              <CheckCircle2 aria-hidden="true" />
              <span>
                已过账生效，调出仓库库存已扣减，调入仓库库存已入库。调拨总成本
                <b>
                  {" "}
                  ¥
                  {Number(document.totalAmount).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
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

          <footer className="transfer-actions">
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
