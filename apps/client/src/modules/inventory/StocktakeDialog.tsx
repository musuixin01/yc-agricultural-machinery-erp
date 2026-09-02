import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  X,
} from "lucide-react";
import { useWarehouses } from "../warehouses/use-warehouses";
import type { InventoryStocktake } from "./inventory-api";
import {
  useCreateStocktake,
  usePostStocktake,
  useSaveStocktakeCounts,
  useSubmitStocktake,
} from "./use-inventory";

type CountDraft = Record<string, { countedQuantity: string; reason: string }>;

export function StocktakeDialog({
  open,
  stocktake,
  onChange,
  onClose,
}: {
  open: boolean;
  stocktake: InventoryStocktake | null;
  onChange: (stocktake: InventoryStocktake) => void;
  onClose: () => void;
}) {
  const warehouses = useWarehouses("", "ACTIVE");
  const create = useCreateStocktake();
  const save = useSaveStocktakeCounts();
  const submit = useSubmitStocktake();
  const post = usePostStocktake();
  const warehouseFocus = useRef<HTMLSelectElement>(null);
  const firstCountFocus = useRef<HTMLInputElement>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [counts, setCounts] = useState<CountDraft>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && !warehouseId && warehouses.data?.items.length) {
      setWarehouseId(
        warehouses.data.items.find((item) => item.isDefault)?.id ??
          warehouses.data.items[0].id,
      );
    }
  }, [open, warehouseId, warehouses.data]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setCounts(
      Object.fromEntries(
        (stocktake?.lines ?? []).map((line) => [
          line.id,
          {
            countedQuantity: line.countedQuantity ?? "",
            reason: line.reason ?? "",
          },
        ]),
      ),
    );
    window.setTimeout(
      () =>
        (stocktake ? firstCountFocus.current : warehouseFocus.current)?.focus(),
      0,
    );
  }, [open, stocktake]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const summary = useMemo(() => {
    if (!stocktake) return { counted: 0, gain: 0, loss: 0, unchanged: 0 };
    return stocktake.lines.reduce(
      (result, line) => {
        const raw = counts[line.id]?.countedQuantity;
        if (raw === undefined || raw === "") return result;
        result.counted += 1;
        const variance = Number(raw) - Number(line.baselineQuantity);
        if (variance > 0) result.gain += 1;
        else if (variance < 0) result.loss += 1;
        else result.unchanged += 1;
        return result;
      },
      { counted: 0, gain: 0, loss: 0, unchanged: 0 },
    );
  }, [counts, stocktake]);

  if (!open) return null;
  const pending =
    create.isPending || save.isPending || submit.isPending || post.isPending;

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      onChange(await create.mutateAsync({ warehouseId, businessDate, notes }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建盘点失败");
    }
  }

  function countLines() {
    if (!stocktake) return [];
    return stocktake.lines.map((line) => ({
      lineId: line.id,
      countedQuantity: counts[line.id]?.countedQuantity ?? "",
      reason: counts[line.id]?.reason || undefined,
    }));
  }

  async function saveDraft(andSubmit: boolean) {
    if (!stocktake) return;
    setError("");
    const lines = countLines();
    if (lines.some((line) => !line.countedQuantity)) {
      setError("请录完全部商品的实盘数量，未找到商品时填写 0。");
      return;
    }
    const missingReason = stocktake.lines.find((line) => {
      const draft = counts[line.id];
      return (
        Number(draft?.countedQuantity) !== Number(line.baselineQuantity) &&
        !draft?.reason.trim()
      );
    });
    if (andSubmit && missingReason) {
      setError(`${missingReason.productNameSnapshot} 存在差异，请填写原因。`);
      return;
    }
    try {
      const saved = await save.mutateAsync({ stocktake, lines });
      onChange(andSubmit ? await submit.mutateAsync(saved) : saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存盘点失败");
    }
  }

  async function postTask() {
    if (!stocktake) return;
    if (!window.confirm("过账后会生成不可修改的盘盈盘亏流水，确认复核完成吗？"))
      return;
    setError("");
    try {
      onChange(await post.mutateAsync(stocktake));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "盘点过账失败");
    }
  }

  return (
    <div className="catalog-dialog-backdrop" role="presentation">
      <div
        className="catalog-dialog stocktake-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stocktake-dialog-title"
      >
        <header>
          <div>
            <small>
              {stocktake ? stocktake.documentNumber : "自动冻结账面库存"}
            </small>
            <h2 id="stocktake-dialog-title">
              {stocktake ? "仓库盘点" : "新建盘点"}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭盘点窗口">
            <X aria-hidden="true" />
          </button>
        </header>

        {!stocktake ? (
          <form onSubmit={createTask}>
            <div className="stocktake-intro">
              <ClipboardCheck aria-hidden="true" />
              <div>
                <strong>整仓快速盘点</strong>
                <span>系统自动带出该仓全部有库存商品，无需逐个添加。</span>
              </div>
            </div>
            <div className="catalog-form-row">
              <label htmlFor="stocktake-warehouse">
                <span>盘点仓库 *</span>
                <select
                  id="stocktake-warehouse"
                  ref={warehouseFocus}
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
              <label htmlFor="stocktake-date">
                <span>盘点日期 *</span>
                <input
                  id="stocktake-date"
                  type="date"
                  value={businessDate}
                  onChange={(event) => setBusinessDate(event.target.value)}
                  required
                />
              </label>
            </div>
            <label htmlFor="stocktake-notes">
              <span>备注（可选）</span>
              <input
                id="stocktake-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                placeholder="例如：月末全仓盘点"
              />
            </label>
            <div className="stocktake-caution">
              创建后请暂停该仓的采购入库和销售出库；若库存发生变化，系统会阻止旧盘点过账。
            </div>
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
              <button
                className="primary-button"
                disabled={pending || !warehouseId}
              >
                {create.isPending ? "正在建立…" : "开始盘点"}
              </button>
            </footer>
          </form>
        ) : (
          <div className="stocktake-workspace">
            <div className="stocktake-toolbar">
              <div>
                <strong>{stocktake.warehouse.name}</strong>
                <span>
                  {stocktake.businessDate} · {stocktake.lines.length} 种商品
                </span>
              </div>
              <span
                className={`ledger-status ${stocktake.status.toLowerCase()}`}
              >
                {stocktake.status === "DRAFT"
                  ? "盘点中"
                  : stocktake.status === "SUBMITTED"
                    ? "待过账"
                    : "已过账"}
              </span>
            </div>
            <div className="stocktake-summary" aria-label="盘点进度">
              <span>
                <small>已盘</small>
                <b>
                  {summary.counted}/{stocktake.lines.length}
                </b>
              </span>
              <span className="gain">
                <ArrowUp aria-hidden="true" />
                <small>盘盈</small>
                <b>{summary.gain}</b>
              </span>
              <span className="loss">
                <ArrowDown aria-hidden="true" />
                <small>盘亏</small>
                <b>{summary.loss}</b>
              </span>
              <span>
                <small>相符</small>
                <b>{summary.unchanged}</b>
              </span>
            </div>
            <div className="stocktake-lines">
              <div className="stocktake-line stocktake-head" aria-hidden="true">
                <span>商品</span>
                <span>账面</span>
                <span>实盘</span>
                <span>差异 / 原因</span>
              </div>
              {stocktake.lines.map((line, index) => {
                const draft = counts[line.id] ?? {
                  countedQuantity: "",
                  reason: "",
                };
                const hasCount = draft.countedQuantity !== "";
                const variance = hasCount
                  ? Number(draft.countedQuantity) -
                    Number(line.baselineQuantity)
                  : null;
                return (
                  <div className="stocktake-line" key={line.id}>
                    <div className="stocktake-product">
                      <b>{line.productNameSnapshot}</b>
                      <small>
                        {line.product.code} · {line.unitNameSnapshot}
                      </small>
                    </div>
                    <span className="stocktake-book">
                      <small>账面</small>
                      {Number(line.baselineQuantity).toLocaleString("zh-CN")}
                    </span>
                    <label htmlFor={`count-${line.id}`}>
                      <span>实盘数量</span>
                      <input
                        id={`count-${line.id}`}
                        ref={index === 0 ? firstCountFocus : undefined}
                        value={draft.countedQuantity}
                        onChange={(event) =>
                          setCounts((current) => ({
                            ...current,
                            [line.id]: {
                              ...draft,
                              countedQuantity: event.target.value,
                            },
                          }))
                        }
                        inputMode="decimal"
                        pattern="\d{1,13}(\.\d{1,6})?"
                        placeholder="输入数量"
                        disabled={stocktake.status !== "DRAFT"}
                      />
                    </label>
                    <div className="stocktake-variance">
                      <span
                        className={
                          variance === null
                            ? ""
                            : variance > 0
                              ? "gain"
                              : variance < 0
                                ? "loss"
                                : "same"
                        }
                      >
                        {variance === null
                          ? "待录入"
                          : variance > 0
                            ? `+${variance}`
                            : variance}
                      </span>
                      {variance !== null && variance !== 0 && (
                        <label htmlFor={`reason-${line.id}`}>
                          <span>差异原因</span>
                          <input
                            id={`reason-${line.id}`}
                            value={draft.reason}
                            onChange={(event) =>
                              setCounts((current) => ({
                                ...current,
                                [line.id]: {
                                  ...draft,
                                  reason: event.target.value,
                                },
                              }))
                            }
                            maxLength={240}
                            placeholder="如损坏、漏记"
                            disabled={stocktake.status !== "DRAFT"}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {stocktake.status === "SUBMITTED" && (
              <div className="stocktake-review-note">
                <AlertTriangle aria-hidden="true" />
                已冻结复核。过账前若仓库库存发生变化，系统会拒绝并要求重新盘点。
              </div>
            )}
            {stocktake.status === "POSTED" && (
              <div className="stocktake-posted-note">
                <CheckCircle2 aria-hidden="true" />
                已生成正式盘盈盘亏流水，库存余额已更新。
              </div>
            )}
            {error && (
              <p className="catalog-form-error" role="alert">
                {error}
              </p>
            )}
            <footer className="stocktake-actions">
              <button
                type="button"
                className="outline-button"
                onClick={onClose}
              >
                关闭
              </button>
              {stocktake.status === "DRAFT" && (
                <>
                  <button
                    type="button"
                    className="outline-button"
                    disabled={pending}
                    onClick={() => saveDraft(false)}
                  >
                    保存进度
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={pending}
                    onClick={() => saveDraft(true)}
                  >
                    {pending ? "正在保存…" : "保存并提交复核"}
                  </button>
                </>
              )}
              {stocktake.status === "SUBMITTED" && (
                <button
                  type="button"
                  className="primary-button"
                  disabled={pending}
                  onClick={postTask}
                >
                  {post.isPending ? "正在过账…" : "确认并正式过账"}
                </button>
              )}
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
