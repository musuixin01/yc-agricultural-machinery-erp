import { lazy, Suspense, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  FileText,
  HandCoins,
  Landmark,
  Plus,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { CreateCashTransferDialog } from "../cash/CreateCashTransferDialog";
import { useCashTransfers } from "../cash/use-cash";
import { CreateCashAccountDialog } from "./CreateCashAccountDialog";
import { CreateSupplierPaymentDialog } from "./CreateSupplierPaymentDialog";
import { CreatePaymentReversalDialog } from "./CreatePaymentReversalDialog";
import { ApplySupplierAdvanceDialog } from "./ApplySupplierAdvanceDialog";
import { CreateSupplierAdvanceDialog } from "./CreateSupplierAdvanceDialog";
import type { SupplierAdvance, SupplierPayment } from "./payables-api";
import {
  useCashAccounts,
  usePayableEntries,
  usePostSupplierPayment,
  useSubmitSupplierPayment,
  useSupplierAdvances,
  useSupplierPayments,
} from "./use-payables";

const SupplierPaymentVoucherDialog = lazy(() =>
  import("./SupplierPaymentVoucherDialog").then((module) => ({
    default: module.SupplierPaymentVoucherDialog,
  })),
);
const SupplierStatementDialog = lazy(() =>
  import("./SupplierStatementDialog").then((module) => ({
    default: module.SupplierStatementDialog,
  })),
);

const statusLabels = {
  DRAFT: "草稿",
  SUBMITTED: "待过账",
  POSTED: "已付款",
  REVERSED: "已冲销",
  CANCELLED: "已取消",
} as const;

const accountLabels = {
  CASH: "现金",
  BANK: "银行卡",
  WECHAT: "微信",
  ALIPAY: "支付宝",
  OTHER: "其他",
} as const;

function money(value: string | number) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PayablesWorkspace({
  layout,
}: {
  layout: "desktop" | "mobile";
}) {
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [creatingAdvance, setCreatingAdvance] = useState(false);
  const [creatingTransfer, setCreatingTransfer] = useState(false);
  const [applyingAdvance, setApplyingAdvance] =
    useState<SupplierAdvance | null>(null);
  const [reversingPayment, setReversingPayment] =
    useState<SupplierPayment | null>(null);
  const [paymentVoucher, setPaymentVoucher] = useState<SupplierPayment | null>(
    null,
  );
  const [statementOpen, setStatementOpen] = useState(false);
  const [error, setError] = useState("");
  const accounts = useCashAccounts();
  const entries = usePayableEntries();
  const payments = useSupplierPayments();
  const advances = useSupplierAdvances();
  const transfers = useCashTransfers();
  const submit = useSubmitSupplierPayment();
  const post = usePostSupplierPayment();
  const pending = submit.isPending || post.isPending;
  const cashTotal = useMemo(
    () =>
      accounts.data?.items.reduce(
        (sum, account) => sum + Number(account.balance),
        0,
      ) ?? 0,
    [accounts.data],
  );
  const payableTotal = useMemo(
    () =>
      entries.data?.items.reduce(
        (sum, entry) => sum + Number(entry.outstandingAmount),
        0,
      ) ?? 0,
    [entries.data],
  );
  const advanceAvailable = Number(advances.data?.summary.availableAmount ?? 0);

  async function run(action: "submit" | "post", payment: SupplierPayment) {
    setError("");
    if (
      action === "post" &&
      !window.confirm(
        `确认从“${payment.cashAccount.name}”支付 ¥${money(payment.amount)}？过账后会同时写入资金流水并核销供应商欠款。`,
      )
    )
      return;
    try {
      if (action === "submit") await submit.mutateAsync(payment);
      else setPaymentVoucher(await post.mutateAsync(payment));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "操作失败，请刷新后重试",
      );
    }
  }

  return (
    <div className={`payables-workspace payables-${layout}`}>
      <section className="payables-hero">
        <div>
          <span>资金管理 · 供应商结算</span>
          <h1>给供应商付款</h1>
          <p>这里记录我们欠供应商的款；付款后资金减少，供应商欠款同步减少。</p>
        </div>
        <div className="payables-summary">
          <span>
            <small>我们待付供应商</small>
            <strong>¥{money(payableTotal)}</strong>
          </span>
          <span>
            <small>资金账户余额</small>
            <strong>¥{money(cashTotal)}</strong>
          </span>
          <span>
            <small>可用预付款</small>
            <strong>¥{money(advanceAvailable)}</strong>
          </span>
        </div>
        <div className="payables-actions">
          <button
            className="outline-button"
            onClick={() => setCreatingAccount(true)}
          >
            <Landmark />
            新增资金账户
          </button>
          <button
            className="outline-button"
            onClick={() => setCreatingAdvance(true)}
          >
            <HandCoins />
            预付供应商
          </button>
          <button
            className="outline-button"
            onClick={() => setCreatingTransfer(true)}
          >
            <ArrowRightLeft />
            账户转账
          </button>
          <button
            className="primary-button"
            onClick={() => setCreatingPayment(true)}
          >
            <Plus />
            付供应商款
          </button>
        </div>
      </section>

      <section className="payables-flow" aria-label="供应商付款流程">
        <span>
          <ReceiptText />
          <b>采购欠款</b>
        </span>
        <ArrowRight />
        <span>
          <Banknote />
          <b>我们付款</b>
        </span>
        <ArrowRight />
        <span>
          <CheckCircle2 />
          <b>指定核销</b>
        </span>
        <ArrowRight />
        <span>
          <WalletCards />
          <b>同步入账</b>
        </span>
      </section>

      {error && (
        <div className="ledger-error">
          <AlertTriangle />
          {error}
        </div>
      )}

      <div className="payables-grid">
        <section className="a-panel payables-panel payment-documents">
          <header>
            <div>
              <h2>我们给供应商的付款单</h2>
              <p>草稿不影响资金和欠款，正式过账后不可直接修改</p>
            </div>
            <button
              type="button"
              className="payables-statement-action"
              onClick={() => setStatementOpen(true)}
            >
              <FileText /> 供应商对账
            </button>
          </header>
          <div className="payment-document-list">
            {payments.data?.items.map((payment) => (
              <article
                key={payment.id}
                className={payment.reversal ? "payment-reversed-row" : ""}
              >
                <div className="payment-document-main">
                  <span
                    className={`ledger-status ${payment.status.toLowerCase()}`}
                  >
                    {statusLabels[payment.status]}
                  </span>
                  <strong>{payment.documentNumber}</strong>
                  <small>
                    {payment.supplier.name} · {payment.cashAccount.name} ·{" "}
                    {payment.businessDate}
                  </small>
                </div>
                <div className="payment-document-amount">
                  <small>{payment.allocations.length} 笔核销</small>
                  <b>¥{money(payment.amount)}</b>
                </div>
                <footer>
                  {payment.status === "DRAFT" && (
                    <button
                      disabled={pending}
                      onClick={() => run("submit", payment)}
                    >
                      提交核对
                    </button>
                  )}
                  {payment.status === "SUBMITTED" && (
                    <button
                      className="post-button"
                      disabled={pending}
                      onClick={() => run("post", payment)}
                    >
                      确认付款并过账
                    </button>
                  )}
                  {payment.status === "POSTED" && (
                    <>
                      <span>
                        {payment.postedBy?.displayName ?? "系统"} 已过账
                      </span>
                      <button
                        className="payment-voucher-action"
                        onClick={() => setPaymentVoucher(payment)}
                      >
                        <ReceiptText /> 凭证
                      </button>
                      <button
                        className="payment-reversal-action"
                        onClick={() => setReversingPayment(payment)}
                      >
                        <RotateCcw /> 反核销
                      </button>
                    </>
                  )}
                  {payment.status === "REVERSED" && payment.reversal && (
                    <>
                      <span className="payment-reversed-note">
                        {payment.reversal.documentNumber} ·{" "}
                        {payment.reversal.reason}
                      </span>
                      <button
                        className="payment-voucher-action"
                        onClick={() => setPaymentVoucher(payment)}
                      >
                        <ReceiptText /> 凭证
                      </button>
                    </>
                  )}
                </footer>
              </article>
            ))}
          </div>
          {!payments.isLoading && payments.data?.items.length === 0 && (
            <div className="ledger-empty">
              <Banknote />
              <strong>还没有供应商付款单</strong>
              <span>先建立资金账户，再登记第一笔给供应商的付款。</span>
              <button onClick={() => setCreatingPayment(true)}>
                付供应商款
              </button>
            </div>
          )}
        </section>

        <div className="payables-side">
          <section className="a-panel payables-panel supplier-advance-panel">
            <header>
              <div>
                <h2>供应商预付款</h2>
                <p>独立余额，不计入负应付</p>
              </div>
              <HandCoins />
            </header>
            <div className="supplier-advance-list">
              {advances.data?.items
                .filter(
                  (item) => Number(item.balance?.availableAmount ?? 0) > 0,
                )
                .map((advance) => (
                  <article key={advance.id}>
                    <div>
                      <strong>{advance.supplier.name}</strong>
                      <small>{advance.documentNumber}</small>
                    </div>
                    <span>
                      <b>¥{money(advance.balance?.availableAmount ?? 0)}</b>
                      <button onClick={() => setApplyingAdvance(advance)}>
                        抵扣欠款
                      </button>
                    </span>
                  </article>
                ))}
            </div>
            {!advances.isLoading && advanceAvailable <= 0 && (
              <button
                className="payables-inline-create"
                onClick={() => setCreatingAdvance(true)}
              >
                <Plus /> 登记第一笔预付款
              </button>
            )}
          </section>
          <section className="a-panel payables-panel">
            <header>
              <div>
                <h2>资金账户</h2>
                <p>余额来自不可改写的资金流水</p>
              </div>
              <Landmark />
            </header>
            <div className="cash-account-list">
              {accounts.data?.items.map((account) => (
                <article key={account.id}>
                  <span>{accountLabels[account.type]}</span>
                  <div>
                    <strong>{account.name}</strong>
                    <small>{account.code}</small>
                  </div>
                  <b>¥{money(account.balance)}</b>
                </article>
              ))}
            </div>
            {transfers.data?.items.length ? (
              <div className="cash-transfer-list">
                <small>最近转账</small>
                {transfers.data.items.slice(0, 4).map((transfer) => (
                  <article key={transfer.id}>
                    <div>
                      <strong>
                        {transfer.fromCashAccount.name} →{" "}
                        {transfer.toCashAccount.name}
                      </strong>
                      <small>
                        {transfer.documentNumber} · {transfer.businessDate}
                      </small>
                    </div>
                    <b>¥{money(transfer.amount)}</b>
                  </article>
                ))}
              </div>
            ) : null}
            {!accounts.isLoading && accounts.data?.items.length === 0 && (
              <button
                className="payables-inline-create"
                onClick={() => setCreatingAccount(true)}
              >
                <Plus /> 建立第一个资金账户
              </button>
            )}
          </section>

          <section className="a-panel payables-panel">
            <header>
              <div>
                <h2>我们欠供应商</h2>
                <p>只显示未结清与部分结清</p>
              </div>
              <ReceiptText />
            </header>
            <div className="payable-list payables-entry-list">
              {entries.data?.items.slice(0, 6).map((entry) => (
                <article key={entry.id}>
                  <span>{entry.supplier.name.slice(0, 1)}</span>
                  <div>
                    <strong>{entry.supplier.name}</strong>
                    <small>
                      {entry.sourceDocument.documentNumber} · 到期{" "}
                      {entry.dueDate}
                    </small>
                  </div>
                  <b>¥{money(entry.outstandingAmount)}</b>
                </article>
              ))}
            </div>
            {!entries.isLoading && entries.data?.items.length === 0 && (
              <div className="catalog-state">当前没有待付采购欠款。</div>
            )}
          </section>
        </div>
      </div>

      <CreateCashAccountDialog
        open={creatingAccount}
        onClose={() => setCreatingAccount(false)}
      />
      <CreateCashTransferDialog
        open={creatingTransfer}
        onClose={() => setCreatingTransfer(false)}
      />
      <CreateSupplierPaymentDialog
        open={creatingPayment}
        onClose={() => setCreatingPayment(false)}
      />
      <CreatePaymentReversalDialog
        payment={reversingPayment}
        onClose={() => setReversingPayment(null)}
      />
      <CreateSupplierAdvanceDialog
        open={creatingAdvance}
        onClose={() => setCreatingAdvance(false)}
      />
      <ApplySupplierAdvanceDialog
        advance={applyingAdvance}
        onClose={() => setApplyingAdvance(null)}
      />
      {paymentVoucher && (
        <Suspense fallback={null}>
          <SupplierPaymentVoucherDialog
            payment={paymentVoucher}
            onClose={() => setPaymentVoucher(null)}
          />
        </Suspense>
      )}
      {statementOpen && (
        <Suspense fallback={null}>
          <SupplierStatementDialog
            open
            onClose={() => setStatementOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
