import {
  ArrowRight,
  BadgeDollarSign as BadgeChineseYuan,
  BarChart3,
  Bell,
  Box,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  PackageOpen,
  Pencil,
  Plus,
  ReceiptText,
  ScanBarcode,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tractor,
  Truck,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { debts, metrics, type Screen } from "../mockData";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CreateProductDialog } from "../modules/catalog/CreateProductDialog";
import { EditProductDialog } from "../modules/catalog/EditProductDialog";
import type { Product } from "../modules/catalog/catalog-api";
import {
  useCatalogReferences,
  useProducts,
} from "../modules/catalog/use-catalog";
import { CreatePartyDialog } from "../modules/parties/CreatePartyDialog";
import { useParties } from "../modules/parties/use-parties";
import { CreateWarehouseDialog } from "../modules/warehouses/CreateWarehouseDialog";
import {
  useSetDefaultWarehouse,
  useSetWarehouseStatus,
  useWarehouses,
} from "../modules/warehouses/use-warehouses";
import { useAuth } from "../modules/auth/AuthGate";
import { IdentityManagement } from "../modules/auth/IdentityManagement";
import { InventoryLedger } from "../modules/inventory/InventoryLedger";
import { PurchasingWorkspace } from "../modules/purchasing/PurchasingWorkspace";
import { PayablesWorkspace } from "../modules/payables/PayablesWorkspace";
import { ReceivablesWorkspace } from "../modules/receivables/ReceivablesWorkspace";
import { SalesWorkspace } from "../modules/sales/SalesWorkspace";
import { DashboardWorkspace } from "../modules/dashboard/DashboardWorkspace";

const CustomerStatementDialog = lazy(() =>
  import("../modules/receivables/CustomerStatementDialog").then((module) => ({
    default: module.CustomerStatementDialog,
  })),
);

type Props = { screen: Screen; onScreenChange: (screen: Screen) => void };

const mobileNav = [
  ["dashboard", "首页", Home],
  ["sales", "开单", ShoppingCart],
  ["inventory", "商品", Box],
  ["parties", "往来", Users],
] as const;

export function VariantC({ screen, onScreenChange }: Props) {
  const auth = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!profileMenu.current?.contains(event.target as Node))
        setProfileMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [profileMenuOpen]);

  const openSettings = () => {
    setProfileMenuOpen(false);
    sessionStorage.setItem("yc-settings-tab", "profile");
    if (screen === "staff")
      window.dispatchEvent(
        new CustomEvent("yc-open-settings-tab", { detail: "profile" }),
      );
    else onScreenChange("staff");
  };
  const openScanner = () => {
    sessionStorage.setItem("yc-sales-entry-mode", "scan");
    if (screen === "sales")
      window.dispatchEvent(new Event("yc-open-sales-scan"));
    else onScreenChange("sales");
  };
  return (
    <>
      <div className="c-shell">
        <header className="c-header">
          <div className="c-profile-menu" ref={profileMenu}>
            <button
              className="c-logo c-profile-entry"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-label="打开账号菜单"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
            >
              <span>{auth.user.displayName.slice(0, 1)}</span>
              <div>
                <small>当前账号</small>
                <strong>{auth.user.displayName}</strong>
              </div>
              <ChevronRight className="c-profile-chevron" aria-hidden="true" />
            </button>
            {profileMenuOpen && (
              <div className="c-profile-dropdown" role="menu">
                <button role="menuitem" onClick={openSettings}>
                  <Settings aria-hidden="true" />
                  <span>系统设置</span>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button role="menuitem" onClick={() => void auth.logout()}>
                  <UsersRound aria-hidden="true" />
                  <span>切换账号</span>
                </button>
                <button
                  className="logout"
                  role="menuitem"
                  onClick={() => void auth.logout()}
                >
                  <LogOut aria-hidden="true" />
                  <span>安全退出</span>
                </button>
              </div>
            )}
          </div>
          <div className="c-search">
            <Search />
            <input
              name="globalSearch"
              aria-label="全局搜索"
              placeholder="搜商品、客户、欠款"
            />
          </div>
          <button className="icon-button">
            <Bell />
            <i />
          </button>
        </header>
        <main className="c-content">
          {screen === "dashboard" && (
            <DashboardWorkspace
              layout="mobile"
              onScreenChange={onScreenChange}
            />
          )}
          {screen === "sales" && <SalesWorkspace layout="mobile" />}
          {screen === "purchasing" && (
            <PurchasingWorkspace
              layout="mobile"
              onOpenPayables={() => onScreenChange("payables")}
            />
          )}
          {screen === "payables" && <PayablesWorkspace layout="mobile" />}
          {screen === "inventory" && (
            <CInventory onScreenChange={onScreenChange} />
          )}
          {screen === "stock" && <InventoryLedger layout="mobile" />}
          {screen === "warehouses" && <CWarehouses />}
          {screen === "staff" && <IdentityManagement layout="mobile" />}
          {screen === "parties" && <CParties />}
          {screen === "debts" && <ReceivablesWorkspace layout="mobile" />}
        </main>
      </div>
      {createPortal(
        <nav className="c-nav" aria-label="手机端主导航">
          {mobileNav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={
                screen === key ||
                (key === "parties" && screen === "payables") ||
                (key === "inventory" &&
                  (screen === "warehouses" || screen === "stock"))
                  ? "active"
                  : ""
              }
              onClick={() => onScreenChange(key)}
            >
              <Icon />
              <span>
                {key === "inventory" && screen === "stock"
                  ? "库存"
                  : key === "inventory" && screen === "warehouses"
                    ? "仓库"
                    : label}
              </span>
            </button>
          ))}
          <button
            className="c-scan"
            onClick={openScanner}
            aria-label="扫码开单"
          >
            <span>
              <ScanBarcode />
            </span>
          </button>
        </nav>,
        document.body,
      )}
    </>
  );
}

function CDashboard({
  onScreenChange,
}: {
  onScreenChange: (s: Screen) => void;
}) {
  return (
    <>
      <section className="c-hero">
        <div>
          <span>8 月 12 日 · 门店经营正常</span>
          <h1>早上好，白老板 👋</h1>
          <p>今天已完成 8 笔销售，还有 3 笔逾期欠款需要跟进。</p>
        </div>
        <button>
          <BarChart3 />
          查看经营报告
        </button>
      </section>
      <section className="c-balance-card">
        <div>
          <span>今日销售额</span>
          <strong>
            ¥ 18,640<small>.00</small>
          </strong>
          <p>
            <em>↑ 12.8%</em> 比昨日多 ¥2,110
          </p>
        </div>
        <div className="c-mini-chart">
          {[35, 52, 42, 68, 55, 78, 88, 65, 92, 75, 100, 86].map((h, i) => (
            <i
              key={i}
              style={{ height: `${h}%` }}
              className={i === 10 ? "active" : ""}
            />
          ))}
        </div>
        <div className="c-balance-meta">
          <span>
            <small>今日收款</small>
            <b>¥12,380</b>
          </span>
          <span>
            <small>今日毛利</small>
            <b>¥4,260</b>
          </span>
        </div>
      </section>
      <section className="c-quick-section">
        <div className="c-section-title">
          <div>
            <h2>常用功能</h2>
            <p>一步完成日常经营</p>
          </div>
          <button>
            全部 <ChevronRight />
          </button>
        </div>
        <div className="c-actions">
          <button
            onClick={() => {
              sessionStorage.setItem("yc-sales-entry-mode", "scan");
              onScreenChange("sales");
            }}
          >
            <span className="green">
              <ScanBarcode />
            </span>
            <strong>扫码开单</strong>
            <small>快速销售</small>
          </button>
          <button onClick={() => onScreenChange("purchasing")}>
            <span className="blue">
              <Truck />
            </span>
            <strong>采购入库</strong>
            <small>到货登记</small>
          </button>
          <button onClick={() => onScreenChange("debts")}>
            <span className="amber">
              <CircleDollarSign />
            </span>
            <strong>向客户收款</strong>
            <small>客户欠款减少</small>
          </button>
          <button onClick={() => onScreenChange("inventory")}>
            <span className="purple">
              <PackageOpen />
            </span>
            <strong>库存盘点</strong>
            <small>实盘录入</small>
          </button>
        </div>
      </section>
      <div className="c-dashboard-grid">
        <section className="c-panel c-todo">
          <div className="c-section-title">
            <div>
              <h2>待办提醒</h2>
              <p>按紧急程度排序</p>
            </div>
            <span className="count-badge">5</span>
          </div>
          <button onClick={() => onScreenChange("debts")}>
            <span className="todo-icon red">
              <Clock3 />
            </span>
            <div>
              <strong>3 笔客户欠款已逾期</strong>
              <small>合计 ¥18,960，最长逾期 23 天</small>
            </div>
            <ChevronRight />
          </button>
          <button onClick={() => onScreenChange("inventory")}>
            <span className="todo-icon orange">
              <Box />
            </span>
            <div>
              <strong>38 项商品库存偏低</strong>
              <small>建议今天完成补货检查</small>
            </div>
            <ChevronRight />
          </button>
          <button>
            <span className="todo-icon blue">
              <BadgeChineseYuan />
            </span>
            <div>
              <strong>4 笔收款等待核销</strong>
              <small>合计 ¥12,380</small>
            </div>
            <ChevronRight />
          </button>
        </section>
        <section className="c-panel c-recent">
          <div className="c-section-title">
            <div>
              <h2>最近销售</h2>
              <p>今天 · 8 笔</p>
            </div>
            <button>
              查看全部 <ChevronRight />
            </button>
          </div>
          {[
            ["王建国", "09:42", "¥ 3,860", "微信"],
            ["李明农场", "09:12", "¥ 8,400", "赊账"],
            ["散客", "08:48", "¥ 560", "现金"],
          ].map((r) => (
            <div className="c-sale-item" key={r[1]}>
              <span>{r[0][0]}</span>
              <div>
                <strong>{r[0]}</strong>
                <small>
                  {r[1]} · {r[3]}
                </small>
              </div>
              <b>{r[2]}</b>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function CPageHead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="c-page-head">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

function CInventory({
  onScreenChange,
}: {
  onScreenChange: (screen: Screen) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const products = useProducts(search, categoryId);
  const references = useCatalogReferences();
  return (
    <div className="catalog-page catalog-page-c">
      <section className="catalog-hero-c">
        <span>玉春 YC · 商品中心</span>
        <div>
          <h1>店里的商品</h1>
          <strong>
            {products.data?.total ?? "—"}
            <small> 项</small>
          </strong>
        </div>
        <p>名称、型号、编码或条码，都能快速找到。</p>
      </section>
      <div className="c-inventory-top">
        <div className="c-search">
          <Search />
          <input
            name="productSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜商品或扫条码"
          />
        </div>
        <button aria-label="扫码">
          <ScanBarcode />
        </button>
      </div>
      <button
        className="c-warehouse-link"
        onClick={() => onScreenChange("stock")}
      >
        <PackageOpen />
        <span>
          <strong>库存账本</strong>
          <small>期初库存、真实数量与成本</small>
        </span>
        <ChevronRight />
      </button>
      <button
        className="c-warehouse-link"
        onClick={() => onScreenChange("warehouses")}
      >
        <Store />
        <span>
          <strong>仓库与库位</strong>
          <small>管理商品存放地点</small>
        </span>
        <ChevronRight />
      </button>
      <div className="c-category-pills">
        <button
          className={categoryId === "" ? "active" : ""}
          onClick={() => setCategoryId("")}
        >
          全部
        </button>
        {references.data?.categories.map((category) => (
          <button
            key={category.id}
            className={categoryId === category.id ? "active" : ""}
            onClick={() => setCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      <div className="c-catalog-result">
        <span>商品清单</span>
        <small>
          {products.isFetching
            ? "更新中…"
            : `${products.data?.items.length ?? 0} 项结果`}
        </small>
      </div>
      {products.isLoading && <div className="catalog-state">正在加载商品…</div>}
      {products.isError && (
        <div className="catalog-state error">加载失败，请检查服务后重试。</div>
      )}
      <section className="c-product-list">
        {products.data?.items.map((p, i) => (
          <article
            key={p.id}
            className={p.status === "INACTIVE" ? "is-inactive" : ""}
          >
            <span
              className="c-product-photo"
              style={{
                background: ["#eef2e8", "#e8eef2", "#f3ece3", "#ece8f3"][i % 4],
              }}
            >
              <Tractor />
            </span>
            <div>
              <div className="c-product-meta">
                <span className="product-tag">{p.category.name}</span>
                {p.brand && <span>{p.brand.name}</span>}
              </div>
              <strong>{p.name}</strong>
              <small>
                {p.code}
                {p.model ? ` · ${p.model}` : ""}
              </small>
              <p>
                <b>
                  ¥{" "}
                  {Number(p.retailPrice).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </b>
                <span className={p.status === "INACTIVE" ? "low" : ""}>
                  {p.status === "ACTIVE"
                    ? `安全库存 ${Number(p.safetyStock)} ${p.baseUnit.name}`
                    : "已停用"}
                </span>
              </p>
            </div>
            <button aria-label={`编辑 ${p.name}`} onClick={() => setEditing(p)}>
              <Pencil />
            </button>
          </article>
        ))}
      </section>
      {products.data?.items.length === 0 && (
        <div className="catalog-state">没有找到匹配商品</div>
      )}
      <button className="c-fab" onClick={() => setCreating(true)}>
        <Plus />
        新增商品
      </button>
      <CreateProductDialog open={creating} onClose={() => setCreating(false)} />
      <EditProductDialog product={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CWarehouses() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const warehouses = useWarehouses(search, "");
  const setStatus = useSetWarehouseStatus();
  const setDefault = useSetDefaultWarehouse();
  const pending = setStatus.isPending || setDefault.isPending;
  const defaultWarehouse = warehouses.data?.items.find(
    (item) => item.isDefault,
  );

  return (
    <div className="warehouse-page-c">
      <section className="warehouse-hero-c">
        <span>玉春 YC · 库存基础</span>
        <h1>仓库与库位</h1>
        <p>
          {warehouses.data?.total ?? "—"} 个仓库
          {defaultWarehouse
            ? ` · 默认 ${defaultWarehouse.name}`
            : " · 尚未设置默认仓"}
        </p>
      </section>
      <div className="c-inventory-top">
        <div className="c-search">
          <Search />
          <input
            name="warehouseSearch"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜仓库、地址或库位"
          />
        </div>
      </div>
      {warehouses.isLoading && (
        <div className="catalog-state">正在加载仓库…</div>
      )}
      {warehouses.isError && (
        <div className="catalog-state error">加载失败，请检查服务后重试。</div>
      )}
      <section className="c-warehouse-list">
        {warehouses.data?.items.map((warehouse) => (
          <article key={warehouse.id}>
            <header>
              <span className="warehouse-icon">
                <Store />
              </span>
              <div>
                <span>
                  {warehouse.isDefault && <em>默认</em>}
                  {warehouse.status === "INACTIVE" && (
                    <em className="off">停用</em>
                  )}
                </span>
                <strong>{warehouse.name}</strong>
                <small>{warehouse.code}</small>
              </div>
            </header>
            <p>{warehouse.address || "尚未填写仓库地址"}</p>
            <div className="warehouse-location-list">
              <span>库位</span>
              {warehouse.locations.length ? (
                warehouse.locations.map((location) => (
                  <b key={location.id}>{location.name}</b>
                ))
              ) : (
                <small>暂未设置</small>
              )}
            </div>
            <footer>
              {!warehouse.isDefault && warehouse.status === "ACTIVE" && (
                <button
                  disabled={pending}
                  onClick={() => setDefault.mutate(warehouse)}
                >
                  设为默认
                </button>
              )}
              <button
                disabled={pending || warehouse.isDefault}
                onClick={() =>
                  setStatus.mutate({
                    warehouse,
                    status:
                      warehouse.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                  })
                }
              >
                {warehouse.status === "ACTIVE" ? "停用" : "启用"}
              </button>
            </footer>
          </article>
        ))}
      </section>
      {warehouses.data?.items.length === 0 && (
        <div className="catalog-state warehouse-empty">
          <strong>还没有仓库</strong>
          <span>新增第一个仓库，明确商品存放地点。</span>
        </div>
      )}
      <button className="c-fab" onClick={() => setCreating(true)}>
        <Plus />
        新增仓库
      </button>
      <CreateWarehouseDialog
        open={creating}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}

function CParties() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [creating, setCreating] = useState(false);
  const [statementCustomerId, setStatementCustomerId] = useState<string | null>(
    null,
  );
  const parties = useParties(search, role);
  return (
    <>
      <CPageHead
        eyebrow="基础资料"
        title="客户与供应商"
        description="一个单位可以同时拥有客户和供应商身份。"
      />
      <div className="c-inventory-top">
        <div className="c-search">
          <Search />
          <input
            name="partySearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜名称、联系人或电话"
          />
        </div>
      </div>
      <div className="c-category-pills">
        <button
          className={role === "" ? "active" : ""}
          onClick={() => setRole("")}
        >
          全部 {parties.data?.total ?? "—"}
        </button>
        <button
          className={role === "CUSTOMER" ? "active" : ""}
          onClick={() => setRole("CUSTOMER")}
        >
          客户
        </button>
        <button
          className={role === "SUPPLIER" ? "active" : ""}
          onClick={() => setRole("SUPPLIER")}
        >
          供应商
        </button>
      </div>
      {parties.isLoading && (
        <div className="catalog-state">正在加载往来单位…</div>
      )}
      {parties.isError && (
        <div className="catalog-state error">加载失败，请检查服务后重试。</div>
      )}
      <section className="c-party-list">
        {parties.data?.items.map((p, i) => {
          const c = p.contacts.find((x) => x.isPrimary) ?? p.contacts[0];
          return (
            <article key={p.id}>
              <span className={`c-party-avatar tone-${i % 4}`}>
                {p.name.slice(0, 1)}
              </span>
              <div>
                <div className="c-party-tags">
                  {p.roles.map((r) => (
                    <span key={r}>{r === "CUSTOMER" ? "客户" : "供应商"}</span>
                  ))}
                  {p.status === "INACTIVE" && (
                    <span className="inactive">已停用</span>
                  )}
                </div>
                <strong>{p.name}</strong>
                <small>
                  {p.code}
                  {c
                    ? ` · ${c.name}${c.phone ? ` ${c.phone}` : ""}`
                    : " · 暂无联系人"}
                </small>
                <p>
                  <span>
                    信用额度 ¥{Number(p.creditLimit).toLocaleString("zh-CN")}
                  </span>
                  <span>
                    {p.paymentTermsDays
                      ? `${p.paymentTermsDays} 天账期`
                      : "现结"}
                  </span>
                </p>
              </div>
              {p.roles.includes("CUSTOMER") ? (
                <button
                  aria-label={`查看${p.name}的客户对账单`}
                  onClick={() => setStatementCustomerId(p.id)}
                >
                  <ReceiptText aria-hidden="true" />
                </button>
              ) : (
                <span className="c-party-no-action" aria-hidden="true">
                  <ChevronRight />
                </span>
              )}
            </article>
          );
        })}
      </section>
      {parties.data?.items.length === 0 && (
        <div className="catalog-state">
          <strong>还没有客户或供应商</strong>
          <br />
          点击右下角按钮开始录入。
        </div>
      )}
      <button className="c-fab" onClick={() => setCreating(true)}>
        <Plus />
        新增往来单位
      </button>
      <CreatePartyDialog open={creating} onClose={() => setCreating(false)} />
      {statementCustomerId && (
        <Suspense fallback={null}>
          <CustomerStatementDialog
            open
            initialCustomerId={statementCustomerId}
            onClose={() => setStatementCustomerId(null)}
          />
        </Suspense>
      )}
    </>
  );
}

function CDebts() {
  return (
    <>
      <CPageHead
        eyebrow="往来账 · 客户欠款"
        title="客户欠款跟进"
        description="这里记录客户尚未结清的货款；收到款项后登记收款并完成核销。"
      />
      <section className="c-debt-overview">
        <div>
          <span>客户欠款</span>
          <strong>¥ 86,420</strong>
          <small>26 位欠款客户</small>
        </div>
        <span className="c-overdue">
          <small>已逾期</small>
          <b>¥18,960</b>
          <em>3 人</em>
        </span>
      </section>
      <div className="c-debt-tabs">
        <button className="active">全部</button>
        <button>已逾期 3</button>
        <button>今日到期 1</button>
        <button>正常账期</button>
      </div>
      <section className="c-debt-cards">
        {debts.map((d) => (
          <article key={d.name}>
            <div className="c-debt-head">
              <span className={`debt-avatar ${d.level}`}>{d.name[0]}</span>
              <div>
                <strong>{d.name}</strong>
                <small>{d.contact}</small>
              </div>
              <span className={`due-text ${d.level}`}>{d.due}</span>
            </div>
            <div className="c-debt-money">
              <span>
                <small>客户欠款</small>
                <strong>{d.amount}</strong>
              </span>
              <span>
                <small>最近交易</small>
                <b>8 月 10 日</b>
              </span>
            </div>
            <div className="c-debt-actions">
              <button>
                <MessageCircle />
                联系客户
              </button>
              <button>
                <CircleDollarSign />
                收客户款
              </button>
              <button>
                对账单
                <ArrowRight />
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
