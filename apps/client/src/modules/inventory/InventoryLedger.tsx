import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  ClipboardList,
  FileClock,
  History,
  Layers3,
  MapPinned,
  PackagePlus,
  PackageX,
  Search,
  ShieldCheck,
  Store,
  Wrench,
} from "lucide-react";
import { useAuth } from "../auth/AuthGate";
import type {
  InventoryLedgerSourceType,
  InventoryTransferDocument,
  OpeningDocument,
} from "./inventory-api";
import type { InventoryStocktake } from "./inventory-api";
import type { InventoryDamageDocument } from "./inventory-api";
import { InventoryDamageDialog } from "./InventoryDamageDialog";
import { StocktakeDialog } from "./StocktakeDialog";
import { TransferDialog } from "./TransferDialog";
import { LowStockRestockDialog } from "./LowStockRestockDialog";
import {
  useInventoryBalances,
  useInventoryDamages,
  useInventoryLedger,
  useInventoryTransfers,
  useOpeningDocuments,
  usePostOpening,
  useStocktakes,
  useSubmitOpening,
} from "./use-inventory";

const ledgerSourceLabel: Record<InventoryLedgerSourceType, string> = {
  INITIAL_STOCK: "建档入库",
  OPENING: "期初库存",
  PURCHASE_RECEIPT: "采购入库",
  PURCHASE_RETURN: "采购退货",
  SALES_DISPATCH: "销售出库",
  CASH_SALE: "现结销售",
  SALES_RETURN: "销售退货",
  SALES_REVERSAL: "销售冲销",
  STOCKTAKE_GAIN: "盘盈",
  STOCKTAKE_LOSS: "盘亏",
  INVENTORY_DAMAGE: "库存报损",
  TRANSFER_OUT: "调拨出库",
  TRANSFER_IN: "调拨入库",
};

const statusLabel = {
  DRAFT: "草稿",
  SUBMITTED: "待过账",
  POSTED: "已过账",
  REVERSED: "已冲销",
  CANCELLED: "已取消",
} as const;

export function InventoryLedger({ layout }: { layout: "desktop" | "mobile" }) {
  const auth = useAuth();
  const canManageLedger = auth.user.permissions.includes("inventory.post");
  const [mode, setMode] = useState<"daily" | "ledger">("daily");
  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [error, setError] = useState("");
  const [restockOpen, setRestockOpen] = useState(false);
  const [stocktakeOpen, setStocktakeOpen] = useState(false);
  const [selectedStocktake, setSelectedStocktake] =
    useState<InventoryStocktake | null>(null);
  const [damageOpen, setDamageOpen] = useState(false);
  const [selectedDamage, setSelectedDamage] =
    useState<InventoryDamageDocument | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] =
    useState<InventoryTransferDocument | null>(null);
  const [ledgerKeyword, setLedgerKeyword] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerSource, setLedgerSource] = useState<
    InventoryLedgerSourceType | ""
  >("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const documents = useOpeningDocuments();
  const balances = useInventoryBalances();
  const submit = useSubmitOpening();
  const post = usePostOpening();
  const stocktakes = useStocktakes();
  const damages = useInventoryDamages();
  const transfers = useInventoryTransfers();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLedgerSearch(ledgerKeyword.trim());
      setLedgerPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ledgerKeyword]);
  const ledger = useInventoryLedger({
    keyword: ledgerSearch || undefined,
    sourceDocumentType: ledgerSource || undefined,
    page: ledgerPage,
    pageSize: 12,
  });
  const totalCost = useMemo(
    () =>
      balances.data?.items.reduce(
        (sum, item) => sum + Number(item.totalCost),
        0,
      ) ?? 0,
    [balances.data],
  );
  const lowCount = useMemo(
    () =>
      balances.data?.items.filter(
        (item) => Number(item.quantity) <= Number(item.product.safetyStock),
      ).length ?? 0,
    [balances.data],
  );
  const visibleBalances = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (balances.data?.items ?? []).filter((item) => {
      const low = Number(item.quantity) <= Number(item.product.safetyStock);
      if (onlyLow && !low) return false;
      return (
        !keyword ||
        item.product.name.toLowerCase().includes(keyword) ||
        item.product.code.toLowerCase().includes(keyword) ||
        item.warehouse.name.toLowerCase().includes(keyword)
      );
    });
  }, [balances.data, onlyLow, search]);
  const pending = submit.isPending || post.isPending;

  async function run(action: "submit" | "post", document: OpeningDocument) {
    setError("");
    if (
      action === "post" &&
      !window.confirm(
        "正式过账后库存流水不可直接修改。确认数量和成本已经核对无误吗？",
      )
    )
      return;
    try {
      if (action === "submit") await submit.mutateAsync(document);
      else await post.mutateAsync(document);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "操作失败，请刷新后重试",
      );
    }
  }

  const balancePanel = (
    <section className="a-panel ledger-panel balance-panel">
      <header>
        <div>
          <h2>{mode === "daily" ? "商品库存" : "当前库存余额"}</h2>
          <p>
            {mode === "daily"
              ? `共 ${balances.data?.items.length ?? 0} 项，只显示正式库存`
              : "只来自正式过账流水"}
          </p>
        </div>
        <Layers3 />
      </header>
      {mode === "daily" && (
        <div className="inventory-balance-toolbar">
          <label>
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索商品名称、编号或仓库"
            />
          </label>
          <div className="inventory-balance-toolbar-actions">
            <button
              type="button"
              className={onlyLow ? "active" : ""}
              onClick={() => setOnlyLow((current) => !current)}
            >
              只看库存不足 {lowCount ? `(${lowCount})` : ""}
            </button>
            <button
              type="button"
              className="inventory-restock-btn"
              onClick={() => setRestockOpen(true)}
            >
              <AlertTriangle size={15} /> 预警补货中心{" "}
              {lowCount ? `(${lowCount})` : ""}
            </button>
          </div>
        </div>
      )}
      <div className="balance-list">
        {visibleBalances.map((item) => {
          const low = Number(item.quantity) <= Number(item.product.safetyStock);
          return (
            <article key={item.id}>
              <span className="balance-avatar">
                {item.product.name.slice(0, 1)}
              </span>
              <div>
                <strong>{item.product.name}</strong>
                <small>
                  {item.product.code} · {item.warehouse.name}
                </small>
              </div>
              <span className={low ? "low" : ""}>
                <b>{Number(item.quantity).toLocaleString("zh-CN")}</b>
                <small>{item.product.unitName}</small>
              </span>
              <em>¥{Number(item.averageCost).toLocaleString("zh-CN")}</em>
            </article>
          );
        })}
      </div>
      {!balances.isLoading && visibleBalances.length === 0 && (
        <div className="catalog-state">
          {balances.data?.items.length
            ? "没有符合条件的商品。"
            : "完成期初库存或采购入库后，这里会自动显示真实库存。"}
        </div>
      )}
    </section>
  );

  return (
    <div className={`inventory-ledger inventory-ledger-${layout}`}>
      <nav className="inventory-mode-tabs" aria-label="库存页面模式">
        <button
          type="button"
          className={mode === "daily" ? "active" : ""}
          onClick={() => setMode("daily")}
        >
          <Store /> 日常库存
        </button>
        {canManageLedger && (
          <button
            type="button"
            className={mode === "ledger" ? "active" : ""}
            onClick={() => setMode("ledger")}
          >
            <Wrench /> 专业账本
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("prototype", "warehouse-spatial");
            url.searchParams.set("map", layout === "mobile" ? "C" : "A");
            window.location.href = url.toString();
          }}
        >
          <MapPinned /> 空间找货 · 预览
        </button>
      </nav>

      <section className={`ledger-hero ${mode === "daily" ? "daily" : ""}`}>
        <div>
          <span>{mode === "daily" ? "门店库存" : "老板 / 库管"}</span>
          <h1>{mode === "daily" ? "库存" : "专业库存账本"}</h1>
          <p>
            {mode === "daily"
              ? "采购收货自动增加，完成销售自动扣减；平时只需查看数量和库存不足。"
              : "管理期初、成本与正式单据，每一次变化都可追溯。"}
          </p>
        </div>
        <div className="ledger-hero-stats">
          <span>
            <small>库存商品</small>
            <strong>{balances.data?.items.length ?? "—"}</strong>
          </span>
          <span>
            <small>{mode === "daily" ? "库存不足" : "库存成本"}</small>
            <strong className={mode === "daily" && lowCount ? "warn" : ""}>
              {mode === "daily"
                ? lowCount
                : `¥${totalCost.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </strong>
          </span>
        </div>
      </section>

      {error && (
        <div className="ledger-error">
          <AlertTriangle /> {error}
        </div>
      )}

      {mode === "daily" ? (
        <>
          <section className="inventory-daily-guide">
            <span>
              <b>供应商到货</b>
              <small>去采购入库，完成后库存自动增加</small>
            </span>
            <span>
              <b>卖出商品</b>
              <small>去销售开单，完成后库存自动扣减</small>
            </span>
            <span>
              <b>数量不对</b>
              <small>盘错用盘点，损坏品使用库存报损</small>
            </span>
          </section>
          {balancePanel}
        </>
      ) : (
        <>
          <section className="ledger-rules">
            <span>
              <FileClock />
              <b>草稿</b>
              <small>可核对</small>
            </span>
            <i>→</i>
            <span>
              <ShieldCheck />
              <b>已提交</b>
              <small>待确认</small>
            </span>
            <i>→</i>
            <span>
              <Check />
              <b>已过账</b>
              <small>不可改</small>
            </span>
          </section>
          <section className="a-panel ledger-panel inventory-ledger-history">
            <header>
              <div>
                <h2>库存流水</h2>
                <p>每次正式库存变化都可按商品和单据追查</p>
              </div>
              <History aria-hidden="true" />
            </header>
            <div className="inventory-ledger-filters">
              <label>
                <Search aria-hidden="true" />
                <span className="sr-only">搜索库存流水</span>
                <input
                  value={ledgerKeyword}
                  onChange={(event) => setLedgerKeyword(event.target.value)}
                  placeholder="搜索商品名称、编号或条码"
                />
              </label>
              <label>
                <span className="sr-only">筛选业务类型</span>
                <select
                  value={ledgerSource}
                  onChange={(event) => {
                    setLedgerSource(
                      event.target.value as InventoryLedgerSourceType | "",
                    );
                    setLedgerPage(1);
                  }}
                >
                  <option value="">全部业务</option>
                  {Object.entries(ledgerSourceLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {ledger.isLoading && (
              <div className="catalog-state">正在加载库存流水…</div>
            )}
            {ledger.isError && (
              <div className="catalog-state error" role="alert">
                库存流水加载失败，请刷新后重试
              </div>
            )}
            <div className="inventory-ledger-entry-list">
              {ledger.data?.items.map((item) => {
                const quantity = Number(item.quantityChange);
                return (
                  <article key={item.id}>
                    <span className={quantity >= 0 ? "in" : "out"}>
                      {quantity >= 0 ? "+" : "−"}
                    </span>
                    <div className="inventory-ledger-product">
                      <strong>{item.product.name}</strong>
                      <small>
                        {item.product.code} · {item.warehouse.name}
                      </small>
                    </div>
                    <div className="inventory-ledger-source">
                      <b>{ledgerSourceLabel[item.sourceDocumentType]}</b>
                      <small>
                        {item.sourceDocumentNumber ?? "原始单据"} ·{" "}
                        {item.businessDate}
                      </small>
                    </div>
                    <div className="inventory-ledger-quantity">
                      <strong className={quantity >= 0 ? "in" : "out"}>
                        {quantity > 0 ? "+" : ""}
                        {quantity.toLocaleString("zh-CN")}
                      </strong>
                      <small>
                        {item.product.unitName} · ¥
                        {Math.abs(Number(item.costAmount)).toLocaleString(
                          "zh-CN",
                          { minimumFractionDigits: 2 },
                        )}
                      </small>
                    </div>
                  </article>
                );
              })}
            </div>
            {!ledger.isLoading && ledger.data?.items.length === 0 && (
              <div className="ledger-empty compact">
                <History aria-hidden="true" />
                <strong>没有符合条件的库存流水</strong>
                <span>完成入库、销售、退货、盘点或报损后会自动记录。</span>
              </div>
            )}
            {ledger.data && ledger.data.pagination.total > 0 && (
              <footer className="inventory-ledger-pagination">
                <span>共 {ledger.data.pagination.total} 条</span>
                <div>
                  <button
                    type="button"
                    aria-label="上一页"
                    disabled={ledgerPage <= 1 || ledger.isFetching}
                    onClick={() => setLedgerPage((page) => page - 1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <b>
                    {ledgerPage} / {ledger.data.pagination.totalPages}
                  </b>
                  <button
                    type="button"
                    aria-label="下一页"
                    disabled={
                      ledgerPage >= ledger.data.pagination.totalPages ||
                      ledger.isFetching
                    }
                    onClick={() => setLedgerPage((page) => page + 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              </footer>
            )}
          </section>
          <section className="a-panel ledger-panel stocktake-panel">
            <header>
              <div>
                <h2>库存盘点</h2>
                <p>自动带出整仓商品，只录实盘数量</p>
              </div>
              <button
                type="button"
                className="stocktake-create-button"
                onClick={() => {
                  setSelectedStocktake(null);
                  setStocktakeOpen(true);
                }}
              >
                <ClipboardList aria-hidden="true" /> 新建盘点
              </button>
            </header>
            {stocktakes.isLoading && (
              <div className="catalog-state">正在加载盘点记录…</div>
            )}
            {stocktakes.isError && (
              <div className="catalog-state error">盘点记录加载失败</div>
            )}
            <div className="stocktake-document-list">
              {stocktakes.data?.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setSelectedStocktake(item);
                    setStocktakeOpen(true);
                  }}
                >
                  <span
                    className={`ledger-status ${item.status.toLowerCase()}`}
                  >
                    {item.status === "DRAFT"
                      ? "盘点中"
                      : item.status === "SUBMITTED"
                        ? "待过账"
                        : "已过账"}
                  </span>
                  <span>
                    <b>{item.documentNumber}</b>
                    <small>
                      {item.warehouse.name} · {item.businessDate}
                    </small>
                  </span>
                  <span>
                    <b>
                      {item.progress.counted}/{item.progress.total}
                    </b>
                    <small>{item.varianceCount} 项差异</small>
                  </span>
                </button>
              ))}
            </div>
            {!stocktakes.isLoading && stocktakes.data?.items.length === 0 && (
              <div className="ledger-empty compact">
                <ClipboardList aria-hidden="true" />
                <strong>还没有盘点记录</strong>
                <span>新建后会自动带出当前仓库全部有库存商品。</span>
              </div>
            )}
          </section>
          <section className="a-panel ledger-panel damage-panel">
            <header>
              <div>
                <h2>库存报损</h2>
                <p>损坏、锈蚀或无法销售的商品正式出库</p>
              </div>
              <button
                type="button"
                className="damage-create-button"
                onClick={() => {
                  setSelectedDamage(null);
                  setDamageOpen(true);
                }}
              >
                <PackageX aria-hidden="true" /> 新建报损
              </button>
            </header>
            {damages.isLoading && (
              <div className="catalog-state">正在加载报损记录…</div>
            )}
            {damages.isError && (
              <div className="catalog-state error">报损记录加载失败</div>
            )}
            <div className="damage-document-list">
              {damages.data?.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setSelectedDamage(item);
                    setDamageOpen(true);
                  }}
                >
                  <span
                    className={`ledger-status ${item.status.toLowerCase()}`}
                  >
                    {item.status === "DRAFT"
                      ? "草稿"
                      : item.status === "SUBMITTED"
                        ? "待过账"
                        : "已过账"}
                  </span>
                  <span>
                    <b>{item.documentNumber}</b>
                    <small>
                      {item.warehouse.name} · {item.businessDate}
                    </small>
                  </span>
                  <span>
                    <b>{item.lines.length} 种</b>
                    <small>
                      {item.status === "POSTED"
                        ? `成本 ¥${Number(item.totalCost).toLocaleString("zh-CN")}`
                        : "查看明细"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            {!damages.isLoading && damages.data?.items.length === 0 && (
              <div className="ledger-empty compact">
                <PackageX aria-hidden="true" />
                <strong>还没有报损记录</strong>
                <span>损坏商品不要用盘点冲掉，应单独记录报损原因。</span>
              </div>
            )}
          </section>
          <section className="a-panel ledger-panel transfer-panel">
            <header>
              <div>
                <h2>跨仓调拨</h2>
                <p>总仓库、分库与专库之间商品移库调拨</p>
              </div>
              <button
                type="button"
                className="transfer-create-button"
                onClick={() => {
                  setSelectedTransfer(null);
                  setTransferOpen(true);
                }}
              >
                <ArrowRightLeft aria-hidden="true" /> 新建调拨
              </button>
            </header>
            {transfers.isLoading && (
              <div className="catalog-state">正在加载调拨记录…</div>
            )}
            {transfers.isError && (
              <div className="catalog-state error">调拨记录加载失败</div>
            )}
            <div className="transfer-document-list">
              {transfers.data?.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setSelectedTransfer(item);
                    setTransferOpen(true);
                  }}
                >
                  <span
                    className={`ledger-status ${item.status.toLowerCase()}`}
                  >
                    {item.status === "DRAFT"
                      ? "草稿"
                      : item.status === "SUBMITTED"
                        ? "待过账"
                        : "已过账"}
                  </span>
                  <span>
                    <b>{item.documentNumber}</b>
                    <small>
                      {item.sourceWarehouse.name} → {item.targetWarehouse.name}{" "}
                      · {item.businessDate}
                    </small>
                  </span>
                  <span>
                    <b>{item.lines.length} 种商品</b>
                    <small>
                      {item.status === "POSTED"
                        ? `成本 ¥${Number(item.totalAmount).toLocaleString("zh-CN")}`
                        : "查看明细"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            {!transfers.isLoading && transfers.data?.items.length === 0 && (
              <div className="ledger-empty compact">
                <ArrowRightLeft aria-hidden="true" />
                <strong>还没有调拨记录</strong>
                <span>支持主库与分库之间商品调动并自动增减两仓库存。</span>
              </div>
            )}
          </section>
          <div className="ledger-grid">
            <section className="a-panel ledger-panel">
              <header>
                <div>
                  <h2>历史期初记录</h2>
                  <p>仅保留以前已经建立的记录</p>
                </div>
                <PackagePlus />
              </header>
              {documents.isLoading && (
                <div className="catalog-state">正在加载期初单…</div>
              )}
              {documents.isError && (
                <div className="catalog-state error">期初单加载失败</div>
              )}
              <div className="opening-document-list">
                {documents.data?.items.map((document) => (
                  <article key={document.id}>
                    <div className="opening-document-main">
                      <span
                        className={`ledger-status ${document.status.toLowerCase()}`}
                      >
                        {statusLabel[document.status]}
                      </span>
                      <div>
                        <strong>{document.documentNumber}</strong>
                        <small>
                          {document.warehouse.name} · {document.businessDate} ·{" "}
                          {document.lines.length} 种商品
                        </small>
                      </div>
                    </div>
                    <div className="opening-document-amount">
                      <small>期初成本</small>
                      <b>
                        ¥
                        {document.lines
                          .reduce(
                            (sum, line) => sum + Number(line.lineAmount),
                            0,
                          )
                          .toLocaleString("zh-CN", {
                            minimumFractionDigits: 2,
                          })}
                      </b>
                    </div>
                    <footer>
                      {document.status === "DRAFT" && (
                        <button
                          disabled={pending}
                          onClick={() => run("submit", document)}
                        >
                          提交核对
                        </button>
                      )}
                      {document.status === "SUBMITTED" && (
                        <button
                          className="post-button"
                          disabled={pending}
                          onClick={() => run("post", document)}
                        >
                          正式过账
                        </button>
                      )}
                      {document.status === "POSTED" && (
                        <span>由 {document.postedBy?.displayName} 过账</span>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
              {documents.data?.items.length === 0 && (
                <div className="ledger-empty">
                  <Layers3 />
                  <strong>没有历史期初记录</strong>
                  <span>现在新增商品时可直接填写当前库存。</span>
                </div>
              )}
            </section>
            {balancePanel}
          </div>
        </>
      )}
      <StocktakeDialog
        open={stocktakeOpen}
        stocktake={selectedStocktake}
        onChange={(item) => setSelectedStocktake(item)}
        onClose={() => setStocktakeOpen(false)}
      />
      <InventoryDamageDialog
        open={damageOpen}
        document={selectedDamage}
        onChange={(item) => setSelectedDamage(item)}
        onClose={() => setDamageOpen(false)}
      />
      <TransferDialog
        open={transferOpen}
        document={selectedTransfer}
        onChange={(item) => setSelectedTransfer(item)}
        onClose={() => setTransferOpen(false)}
      />
      <LowStockRestockDialog
        open={restockOpen}
        onClose={() => setRestockOpen(false)}
      />
    </div>
  );
}
