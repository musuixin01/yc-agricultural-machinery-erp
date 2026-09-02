import { lazy, Suspense, useMemo, useState } from "react";
import {
  BanknoteArrowUp,
  CircleCheck,
  Clock3,
  Landmark,
  Plus,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { useCashAccounts } from "../payables/use-payables";
import { CreateCustomerReceiptDialog } from "./CreateCustomerReceiptDialog";
import { CreateReceiptReversalDialog } from "./CreateReceiptReversalDialog";
import { CreateCustomerAdvanceDialog } from "./CreateCustomerAdvanceDialog";
import { ApplyCustomerAdvanceDialog } from "./ApplyCustomerAdvanceDialog";
import type { CustomerAdvance, CustomerReceipt } from "./receivables-api";
import {
  useCustomerAdvances,
  useCustomerReceipts,
  useReceivableEntries,
} from "./use-receivables";

const CustomerStatementDialog = lazy(() =>
  import("./CustomerStatementDialog").then((module) => ({
    default: module.CustomerStatementDialog,
  })),
);
const CustomerReceiptVoucherDialog = lazy(() =>
  import("./CustomerReceiptVoucherDialog").then((module) => ({
    default: module.CustomerReceiptVoucherDialog,
  })),
);

function money(value: string | number) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ReceivablesWorkspace({
  layout,
}: {
  layout: "desktop" | "mobile";
}) {
  const entries = useReceivableEntries();
  const receipts = useCustomerReceipts();
  const accounts = useCashAccounts();
  const advances = useCustomerAdvances();
  const [creating, setCreating] = useState(false);
  const [creatingAdvance, setCreatingAdvance] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementCustomerId, setStatementCustomerId] = useState<
    string | undefined
  >();
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [reversing, setReversing] = useState<CustomerReceipt | null>(null);
  const [receiptVoucher, setReceiptVoucher] = useState<CustomerReceipt | null>(
    null,
  );
  const [applyingAdvance, setApplyingAdvance] =
    useState<CustomerAdvance | null>(null);
  const outstanding = useMemo(
    () =>
      entries.data?.items.reduce(
        (sum, item) => sum + Number(item.outstandingAmount),
        0,
      ) ?? 0,
    [entries.data],
  );
  const overdue = useMemo(
    () =>
      entries.data?.items
        .filter((item) => item.dueDate < new Date().toISOString().slice(0, 10))
        .reduce((sum, item) => sum + Number(item.outstandingAmount), 0) ?? 0,
    [entries.data],
  );

  function receive(customer?: string) {
    setCustomerId(customer);
    setCreating(true);
  }

  function reconcile(customer?: string) {
    setStatementCustomerId(customer);
    setStatementOpen(true);
  }

  return (
    <div
      className={`payables-workspace receivables-workspace payables-${layout}`}
    >
      <section className="payables-hero receivables-hero">
        <div>
          <span>客户欠款 · 正式应收账本</span>
          <h1>客户欠款</h1>
          <p>客户应向我们付款；收款后资金增加，对应客户欠款同步减少。</p>
        </div>
        <div className="payables-summary">
          <span>
            <small>客户未付合计</small>
            <strong>¥{money(outstanding)}</strong>
          </span>
          <span>
            <small>其中已逾期</small>
            <strong>¥{money(overdue)}</strong>
          </span>
          <span>
            <small>可用预收款</small>
            <strong>
              ¥{money(advances.data?.summary.availableAmount ?? 0)}
            </strong>
          </span>
        </div>
        <div className="payables-actions">
          <button className="primary-button" onClick={() => receive()}>
            <Plus />
            登记客户收款
          </button>
          <button
            className="outline-button"
            onClick={() => setCreatingAdvance(true)}
          >
            <WalletCards />
            登记客户预收款
          </button>
          <button className="outline-button" onClick={() => reconcile()}>
            <ReceiptText />
            客户对账单
          </button>
        </div>
      </section>
      <section className="payables-flow" aria-label="客户收款流程">
        <span>
          <ReceiptText />
          <b>客户欠款</b>
        </span>
        <span>→</span>
        <span>
          <BanknoteArrowUp />
          <b>客户付款</b>
        </span>
        <span>→</span>
        <span>
          <CircleCheck />
          <b>指定核销</b>
        </span>
        <span>→</span>
        <span>
          <Landmark />
          <b>资金增加</b>
        </span>
      </section>
      <div className="payables-grid">
        <section className="a-panel payables-panel payment-documents">
          <header>
            <div>
              <h2>待收客户欠款</h2>
              <p>只显示正式销售形成且尚未结清的欠款</p>
            </div>
            <Clock3 />
          </header>
          <div className="payment-document-list receivable-entry-cards">
            {entries.data?.items.map((entry) => (
              <article key={entry.id}>
                <div className="payment-document-main">
                  <span
                    className={`ledger-status ${entry.dueDate < new Date().toISOString().slice(0, 10) ? "submitted" : "draft"}`}
                  >
                    {entry.dueDate < new Date().toISOString().slice(0, 10)
                      ? "已逾期"
                      : "未到期"}
                  </span>
                  <strong>{entry.customer.name}</strong>
                  <small>
                    {entry.sourceDocument.documentNumber} · 到期 {entry.dueDate}
                    {entry.customer.phone ? ` · ${entry.customer.phone}` : ""}
                  </small>
                </div>
                <div className="payment-document-amount">
                  <small>原欠 ¥{money(entry.originalAmount)}</small>
                  <b>¥{money(entry.outstandingAmount)}</b>
                </div>
                <footer>
                  <button
                    className="post-button"
                    onClick={() => receive(entry.customer.id)}
                  >
                    登记这个客户收款
                  </button>
                  <button
                    className="outline-button"
                    onClick={() => reconcile(entry.customer.id)}
                  >
                    查看对账单
                  </button>
                </footer>
              </article>
            ))}
          </div>
          {!entries.isLoading && !entries.data?.items.length && (
            <div className="ledger-empty">
              <CircleCheck />
              <strong>当前没有客户欠款</strong>
              <span>赊账销售正式过账后会自动显示在这里。</span>
            </div>
          )}
        </section>
        <div className="payables-side">
          <section className="a-panel payables-panel">
            <header>
              <div>
                <h2>客户预收款</h2>
                <p>销售形成客户欠款后再抵扣，不重复收款</p>
              </div>
              <WalletCards />
            </header>
            <div className="supplier-advance-list">
              {advances.data?.items.map((advance) => (
                <article key={advance.id}>
                  <div>
                    <strong>{advance.customer.name}</strong>
                    <small>
                      {advance.documentNumber} · 原额 ¥{money(advance.amount)}
                    </small>
                  </div>
                  <b>¥{money(advance.balance?.availableAmount ?? 0)}</b>
                  {Number(advance.balance?.availableAmount ?? 0) > 0 && (
                    <button onClick={() => setApplyingAdvance(advance)}>
                      抵扣欠款
                    </button>
                  )}
                </article>
              ))}
            </div>
            {!advances.isLoading && !advances.data?.items.length && (
              <div className="catalog-state">还没有客户预收款记录。</div>
            )}
          </section>
          <section className="a-panel payables-panel">
            <header>
              <div>
                <h2>最近客户收款</h2>
                <p>每笔均已写入资金流水并核销欠款</p>
              </div>
              <BanknoteArrowUp />
            </header>
            <div className="cash-account-list">
              {receipts.data?.items.map((receipt) => (
                <article
                  className={receipt.reversal ? "receipt-reversed-row" : ""}
                  key={receipt.id}
                >
                  <span>{receipt.reversal ? "已反核销" : "已收"}</span>
                  <div>
                    <strong>{receipt.customer.name}</strong>
                    <small>
                      {receipt.documentNumber} · {receipt.businessDate}
                    </small>
                    {receipt.reversal && (
                      <small>
                        {receipt.reversal.documentNumber} ·{" "}
                        {receipt.reversal.reason}
                      </small>
                    )}
                  </div>
                  <div className="receipt-record-action">
                    <b>¥{money(receipt.amount)}</b>
                    <div>
                      <button onClick={() => setReceiptVoucher(receipt)}>
                        <ReceiptText /> 凭证
                      </button>
                      {!receipt.reversal && (
                        <button onClick={() => setReversing(receipt)}>
                          <RotateCcw /> 反核销
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!receipts.isLoading && !receipts.data?.items.length && (
              <div className="catalog-state">还没有客户收款记录。</div>
            )}
          </section>
          <section className="a-panel payables-panel">
            <header>
              <div>
                <h2>收款账户</h2>
                <p>收款成功后余额实时增加</p>
              </div>
              <Landmark />
            </header>
            <div className="cash-account-list">
              {accounts.data?.items.map((account) => (
                <article key={account.id}>
                  <span>资金</span>
                  <div>
                    <strong>{account.name}</strong>
                    <small>{account.code}</small>
                  </div>
                  <b>¥{money(account.balance)}</b>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
      <CreateCustomerReceiptDialog
        open={creating}
        initialCustomerId={customerId}
        onPosted={setReceiptVoucher}
        onClose={() => setCreating(false)}
      />
      <CreateReceiptReversalDialog
        receipt={reversing}
        onClose={() => setReversing(null)}
      />
      <CreateCustomerAdvanceDialog
        open={creatingAdvance}
        onClose={() => setCreatingAdvance(false)}
      />
      <ApplyCustomerAdvanceDialog
        advance={applyingAdvance}
        onClose={() => setApplyingAdvance(null)}
      />
      {statementOpen && (
        <Suspense fallback={null}>
          <CustomerStatementDialog
            open={statementOpen}
            initialCustomerId={statementCustomerId}
            onClose={() => setStatementOpen(false)}
          />
        </Suspense>
      )}
      {receiptVoucher && (
        <Suspense fallback={null}>
          <CustomerReceiptVoucherDialog
            receipt={receiptVoucher}
            onClose={() => setReceiptVoucher(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
