import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, HandCoins, Info, Landmark, X, Zap } from "lucide-react";
import { useParties } from "../parties/use-parties";
import {
  useCashAccounts,
  useCreateSupplierPayment,
  usePayableEntries,
  usePostSupplierPayment,
  useSupplierAdvances,
} from "./use-payables";
import type { SupplierPayment } from "./payables-api";

function money(value: string | number) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CreateSupplierPaymentDialog({
  open,
  initialSupplierId,
  onPosted,
  onClose,
}: {
  open: boolean;
  initialSupplierId?: string;
  onPosted?: (payment: SupplierPayment) => void;
  onClose: () => void;
}) {
  const suppliers = useParties("", "SUPPLIER");
  const accounts = useCashAccounts();
  const createDraft = useCreateSupplierPayment();
  const postPayment = usePostSupplierPayment();
  const advances = useSupplierAdvances();

  const [supplierId, setSupplierId] = useState(initialSupplierId ?? "");
  const entries = usePayableEntries(supplierId);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [postImmediately, setPostImmediately] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initialSupplierId) {
      setSupplierId(initialSupplierId);
    } else if (!supplierId && suppliers.data?.items.length) {
      setSupplierId(suppliers.data.items[0].id);
    }
  }, [open, initialSupplierId, supplierId, suppliers.data]);

  useEffect(() => {
    setAmounts({});
    setError("");
  }, [supplierId]);

  const total = useMemo(
    () =>
      Object.values(amounts).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0,
      ),
    [amounts],
  );

  // Check if this supplier has available advances
  const supplierAdvance = useMemo(() => {
    if (!supplierId || !advances.data?.items) return null;
    return advances.data.items.find(
      (adv) =>
        adv.supplier.id === supplierId &&
        Number(adv.balance?.availableAmount ?? 0) > 0,
    );
  }, [supplierId, advances.data]);

  if (!open) return null;

  function handleFillAll() {
    if (!entries.data?.items) return;
    const next: Record<string, string> = {};
    for (const item of entries.data.items) {
      next[item.id] = item.outstandingAmount;
    }
    setAmounts(next);
  }

  function handleClearAll() {
    setAmounts({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const allocations = Object.entries(amounts)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([payableEntryId, amount]) => ({ payableEntryId, amount }));

    setError("");
    if (!allocations.length) {
      setError("请至少填写一笔核销金额。");
      return;
    }

    const cashAccountId = String(data.get("cashAccountId"));
    const businessDate = String(data.get("businessDate"));
    const notes = String(data.get("notes") || "");

    const selectedAccount = accounts.data?.items.find(
      (a) => a.id === cashAccountId,
    );
    const selectedSupplier = suppliers.data?.items.find(
      (s) => s.id === supplierId,
    );

    if (postImmediately) {
      if (
        !window.confirm(
          `确认从“${selectedAccount?.name ?? "所选账户"}”向“${selectedSupplier?.name ?? "供应商"}”支付 ¥${money(total)}？\n过账后将同时扣减资金账户并正式核销应付账款。`,
        )
      ) {
        return;
      }
    }

    try {
      // 1. Create payment (draft)
      const created = await createDraft.mutateAsync({
        supplierId,
        cashAccountId,
        businessDate,
        allocations,
      });

      // 2. If immediate post is selected, post it right away
      if (postImmediately) {
        const posted = await postPayment.mutateAsync(created);
        setAmounts({});
        onClose();
        onPosted?.(posted);
      } else {
        setAmounts({});
        onClose();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存支付记录失败");
    }
  }

  const isPending = createDraft.isPending || postPayment.isPending;

  return (
    <div className="catalog-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="catalog-dialog opening-dialog payment-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div className="party-dialog-head-left">
            <span className="party-dialog-badge">
              <Landmark size={18} />
            </span>
            <div>
              <small>资金支出 · 供应商欠款清偿与核销</small>
              <h2>登记给供应商付款</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="catalog-form-row">
            <label>
              <span>收款供应商 *</span>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                {suppliers.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>付款出账账户 *</span>
              <select name="cashAccountId" required>
                {accounts.data?.items
                  .filter((item) => item.status === "ACTIVE")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · 可用 ¥{money(item.balance)}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="catalog-form-row">
            <label>
              <span>付款业务日期 *</span>
              <input
                name="businessDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              <span>转账单号 / 付款说明</span>
              <input
                name="notes"
                maxLength={200}
                placeholder="例如：网银转账流水号、现金结清等"
              />
            </label>
          </div>

          {supplierAdvance && (
            <div className="advance-notice-banner">
              <Info size={15} />
              <span>
                该供应商有可用预付款余额{" "}
                <strong>
                  ¥{money(supplierAdvance.balance?.availableAmount ?? 0)}
                </strong>
                。若无需走现金账户，可使用“预付款抵扣”功能直接冲减。
              </span>
            </div>
          )}

          <div className="payment-allocation-head">
            <div className="allocation-head-left">
              <strong>选择要偿还的采购到货欠款</strong>
              {entries.data && entries.data.items.length > 0 && (
                <div className="allocation-quick-tools">
                  <button
                    type="button"
                    className="quick-link-btn"
                    onClick={handleFillAll}
                  >
                    <Zap size={13} /> 一键全部结清
                  </button>
                  {total > 0 && (
                    <button
                      type="button"
                      className="quick-link-btn text-gray"
                      onClick={handleClearAll}
                    >
                      清空
                    </button>
                  )}
                </div>
              )}
            </div>
            <b className="allocation-total-badge">本次实付 ¥{money(total)}</b>
          </div>

          <div className="payment-entry-list">
            {entries.data?.items.map((item) => {
              const currentAmount = amounts[item.id] ?? "";
              const isFullyPaid =
                Number(currentAmount) === Number(item.outstandingAmount);
              return (
                <article
                  key={item.id}
                  className={currentAmount ? "entry-allocated" : ""}
                >
                  <div>
                    <strong>{item.sourceDocument.documentNumber}</strong>
                    <small>
                      {item.supplier.name} · 到期 {item.dueDate}
                    </small>
                  </div>
                  <span className="entry-unpaid-amount">
                    待付 ¥{money(item.outstandingAmount)}
                  </span>
                  <div className="receipt-amount-control">
                    <input
                      aria-label={`核销 ${item.sourceDocument.documentNumber}`}
                      value={currentAmount}
                      onChange={(e) =>
                        setAmounts((current) => ({
                          ...current,
                          [item.id]: e.target.value,
                        }))
                      }
                      inputMode="decimal"
                      placeholder="核销金额"
                      pattern="\d{1,15}(\.\d{1,4})?"
                    />
                    <button
                      type="button"
                      className={isFullyPaid ? "full-paid-btn" : ""}
                      onClick={() =>
                        setAmounts((current) => ({
                          ...current,
                          [item.id]: item.outstandingAmount,
                        }))
                      }
                    >
                      全额
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!entries.isLoading && entries.data?.items.length === 0 && (
            <div className="catalog-state">
              该供应商当前没有待支付的采购欠款。
            </div>
          )}
          {accounts.data?.items.length === 0 && (
            <p className="catalog-form-error">请先在资金管理中建立资金账户。</p>
          )}

          <div className="payment-post-toggle">
            <label className="checkbox-toggle-label">
              <input
                type="checkbox"
                checked={postImmediately}
                onChange={(e) => setPostImmediately(e.target.checked)}
              />
              <span>
                立即过账结算并生成付款凭证（扣减账户余额并冲销供应商欠款）
              </span>
            </label>
          </div>

          {error && <p className="catalog-form-error">{error}</p>}

          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              disabled={isPending || !accounts.data?.items.length || total <= 0}
            >
              {isPending ? (
                "正在处理…"
              ) : postImmediately ? (
                <>
                  <Check size={16} /> 确认支付 ¥{money(total)} 并过账
                </>
              ) : (
                "存为待审核付款草稿"
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
