import {
  ArrowRight,
  BadgeDollarSign as BadgeChineseYuan,
  Banknote,
  Barcode,
  BarChart3,
  Bell,
  Box,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FileSpreadsheet,
  Home,
  LayoutGrid,
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
  Trash2,
  Truck,
  Users,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { debts, metrics, type Screen } from "../mockData";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CreateProductDialog } from "../modules/catalog/CreateProductDialog";
import { EditProductDialog } from "../modules/catalog/EditProductDialog";
import { ProductBarcodePrintDialog } from "../modules/catalog/ProductBarcodePrintDialog";
import { SwipeableProductItem } from "../modules/catalog/SwipeableProductItem";
import type { Product } from "../modules/catalog/catalog-api";
import {
  useCatalogReferences,
  useProducts,
  useSetProductStatus,
} from "../modules/catalog/use-catalog";
import { CreatePartyDialog } from "../modules/parties/CreatePartyDialog";
import { EditPartyDialog } from "../modules/parties/EditPartyDialog";
import { BatchImportPartiesDialog } from "../modules/parties/BatchImportPartiesDialog";
import { exportPartiesToCsv } from "../modules/parties/parties-export";
import type { Party } from "../modules/parties/parties-api";
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
const SupplierStatementDialog = lazy(() =>
  import("../modules/payables/SupplierStatementDialog").then((module) => ({
    default: module.SupplierStatementDialog,
  })),
);

type Props = { screen: Screen; onScreenChange: (screen: Screen) => void };

const mobileNav = [
  ["dashboard", "首页", Home],
  ["sales", "开单", ShoppingCart],
  ["inventory", "商品/库存", Box],
  ["parties", "往来/欠款", Users],
] as const;

const allModules = [
  {
    id: "dashboard",
    name: "经营看板",
    sub: "总览与待办",
    icon: Home,
    tone: "emerald",
  },
  {
    id: "sales",
    name: "销售开单",
    sub: "出库与小票",
    icon: ShoppingCart,
    tone: "green",
  },
  {
    id: "purchasing",
    name: "采购入库",
    sub: "到货与进货",
    icon: Truck,
    tone: "blue",
  },
  {
    id: "inventory",
    name: "商品中心",
    sub: "品类与规格",
    icon: Box,
    tone: "teal",
  },
  {
    id: "stock",
    name: "库存账本",
    sub: "流水与盘点",
    icon: PackageOpen,
    tone: "cyan",
  },
  {
    id: "warehouses",
    name: "仓库库位",
    sub: "多仓与库位",
    icon: Store,
    tone: "indigo",
  },
  {
    id: "debts",
    name: "客户欠款",
    sub: "应收与核销",
    icon: CircleDollarSign,
    tone: "amber",
  },
  {
    id: "payables",
    name: "供应商应付",
    sub: "应付与付款",
    icon: WalletCards,
    tone: "rose",
  },
  {
    id: "parties",
    name: "往来单位",
    sub: "客户与供应商",
    icon: Users,
    tone: "slate",
  },
  {
    id: "staff",
    name: "系统设置",
    sub: "账号与备份",
    icon: Settings,
    tone: "zinc",
  },
] as const;

const screenTitles: Record<Screen, string> = {
  dashboard: "经营看板",
  sales: "销售开单",
  purchasing: "采购入库",
  inventory: "商品中心",
  stock: "库存账本",
  warehouses: "仓库库位",
  debts: "客户欠款",
  payables: "供应商应付",
  parties: "往来单位",
  staff: "系统设置",
};

export function VariantC({ screen, onScreenChange }: Props) {
  const auth = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
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
    setDrawerOpen(false);
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

  const navigateTo = (targetScreen: Screen) => {
    setDrawerOpen(false);
    onScreenChange(targetScreen);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (screen !== "inventory") {
      onScreenChange("inventory");
    }
  };

  // Determine active domain group for sub-navigation tabs
  const isTradeGroup = screen === "sales" || screen === "purchasing";
  const isInventoryGroup =
    screen === "inventory" || screen === "stock" || screen === "warehouses";
  const isFinanceGroup =
    screen === "parties" || screen === "debts" || screen === "payables";

  return (
    <>
      <div className="c-shell">
        <header className="c-header">
          {/* 1. Module Drawer Trigger */}
          <button
            className="c-menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开全部功能导览"
            title="全部功能"
          >
            <LayoutGrid className="c-grid-icon" aria-hidden="true" />
            <span className="c-menu-label">功能</span>
          </button>

          {/* 2. Global Product & Record Search Input */}
          <form className="c-header-search-form" onSubmit={handleSearchSubmit}>
            <div className="c-header-search">
              <Search className="c-search-icon" aria-hidden="true" />
              <input
                name="cGlobalSearch"
                value={headerSearch}
                onChange={(e) => {
                  setHeaderSearch(e.target.value);
                  if (screen !== "inventory" && e.target.value.trim()) {
                    onScreenChange("inventory");
                  }
                }}
                placeholder="搜索商品名称、型号、条码..."
                aria-label="搜索商品"
              />
              {headerSearch && (
                <button
                  type="button"
                  className="c-search-clear-btn"
                  onClick={() => setHeaderSearch("")}
                  aria-label="清空搜索"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </form>

          {/* 3. User Avatar & Menu */}
          <div className="c-profile-menu" ref={profileMenu}>
            <button
              className="c-avatar-btn"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-label="账号与设置"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
            >
              <span className="c-avatar-letter">
                {auth.user.displayName.slice(0, 1)}
              </span>
            </button>
            {profileMenuOpen && (
              <div className="c-profile-dropdown" role="menu">
                <div className="c-profile-dropdown-user">
                  <strong>{auth.user.displayName}</strong>
                  <small>玉春农机 · 经营人员</small>
                </div>
                <button role="menuitem" onClick={openSettings}>
                  <Settings aria-hidden="true" />
                  <span>系统设置与备份</span>
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
        </header>

        {/* Domain Segmented Switcher for Fast Horizontal Navigation */}
        {isTradeGroup && (
          <div
            className="c-domain-tabs"
            role="tablist"
            aria-label="交易模块切换"
          >
            <button
              role="tab"
              aria-selected={screen === "sales"}
              className={screen === "sales" ? "active" : ""}
              onClick={() => onScreenChange("sales")}
            >
              <ShoppingCart aria-hidden="true" />
              <span>销售开单</span>
            </button>
            <button
              role="tab"
              aria-selected={screen === "purchasing"}
              className={screen === "purchasing" ? "active" : ""}
              onClick={() => onScreenChange("purchasing")}
            >
              <Truck aria-hidden="true" />
              <span>采购入库</span>
            </button>
          </div>
        )}

        {isInventoryGroup && (
          <div
            className="c-domain-tabs"
            role="tablist"
            aria-label="商品与库存切换"
          >
            <button
              role="tab"
              aria-selected={screen === "inventory"}
              className={screen === "inventory" ? "active" : ""}
              onClick={() => onScreenChange("inventory")}
            >
              <Box aria-hidden="true" />
              <span>商品中心</span>
            </button>
            <button
              role="tab"
              aria-selected={screen === "stock"}
              className={screen === "stock" ? "active" : ""}
              onClick={() => onScreenChange("stock")}
            >
              <PackageOpen aria-hidden="true" />
              <span>库存账本</span>
            </button>
            <button
              role="tab"
              aria-selected={screen === "warehouses"}
              className={screen === "warehouses" ? "active" : ""}
              onClick={() => onScreenChange("warehouses")}
            >
              <Store aria-hidden="true" />
              <span>仓库库位</span>
            </button>
          </div>
        )}

        {isFinanceGroup && (
          <div
            className="c-domain-tabs"
            role="tablist"
            aria-label="往来与账款切换"
          >
            <button
              role="tab"
              aria-selected={screen === "parties"}
              className={screen === "parties" ? "active" : ""}
              onClick={() => onScreenChange("parties")}
            >
              <Users aria-hidden="true" />
              <span>往来单位</span>
            </button>
            <button
              role="tab"
              aria-selected={screen === "debts"}
              className={screen === "debts" ? "active" : ""}
              onClick={() => onScreenChange("debts")}
            >
              <CircleDollarSign aria-hidden="true" />
              <span>客户欠款</span>
            </button>
            <button
              role="tab"
              aria-selected={screen === "payables"}
              className={screen === "payables" ? "active" : ""}
              onClick={() => onScreenChange("payables")}
            >
              <WalletCards aria-hidden="true" />
              <span>供应商应付</span>
            </button>
          </div>
        )}

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
            <CInventory
              search={headerSearch}
              onSearchChange={setHeaderSearch}
              onScreenChange={onScreenChange}
            />
          )}
          {screen === "stock" && <InventoryLedger layout="mobile" />}
          {screen === "warehouses" && <CWarehouses />}
          {screen === "staff" && <IdentityManagement layout="mobile" />}
          {screen === "parties" && <CParties />}
          {screen === "debts" && <ReceivablesWorkspace layout="mobile" />}
        </main>
      </div>

      {/* Full Module Drawer Modal */}
      {drawerOpen &&
        createPortal(
          <div
            className="c-module-backdrop"
            onClick={() => setDrawerOpen(false)}
            role="presentation"
          >
            <div
              className="c-module-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="全部功能导览"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="c-module-sheet-header">
                <div>
                  <strong>全部功能导览</strong>
                  <small>一键直达各个业务模块</small>
                </div>
                <button
                  className="c-sheet-close"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="关闭导航"
                >
                  <X />
                </button>
              </div>
              <div className="c-module-grid">
                {allModules.map((m) => {
                  const Icon = m.icon;
                  const isActive = screen === m.id;
                  return (
                    <button
                      key={m.id}
                      className={`c-module-card tone-${m.tone} ${isActive ? "is-active" : ""}`}
                      onClick={() => navigateTo(m.id as Screen)}
                    >
                      <span className="c-module-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <strong>{m.name}</strong>
                      <small>{m.sub}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Bottom Navigation Dock */}
      {createPortal(
        <nav className="c-nav" aria-label="手机端主导航">
          {mobileNav.map(([key, label, Icon]) => {
            const isTabActive =
              screen === key ||
              (key === "inventory" &&
                (screen === "stock" || screen === "warehouses")) ||
              (key === "parties" &&
                (screen === "debts" || screen === "payables"));
            return (
              <button
                key={key}
                className={isTabActive ? "active" : ""}
                onClick={() => onScreenChange(key)}
              >
                <Icon aria-hidden="true" />
                <span>
                  {key === "inventory" && screen === "stock"
                    ? "库存"
                    : key === "inventory" && screen === "warehouses"
                      ? "仓库"
                      : key === "parties" && screen === "debts"
                        ? "欠款"
                        : key === "parties" && screen === "payables"
                          ? "应付"
                          : label}
                </span>
              </button>
            );
          })}
          <button
            className="c-scan"
            onClick={openScanner}
            aria-label="快捷扫码开单"
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
  search,
  onSearchChange,
  onScreenChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onScreenChange: (screen: Screen) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [barcodePrintProducts, setBarcodePrintProducts] = useState<
    Product[] | null
  >(null);
  const products = useProducts(search, categoryId);
  const references = useCatalogReferences();
  const setProductStatus = useSetProductStatus();
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
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all border border-emerald-500/30 shadow-sm"
            onClick={() => setBarcodePrintProducts(products.data?.items ?? [])}
            title="将当前商品批量生成不干胶/货架条码标签"
          >
            <Barcode size={15} />
            批量打印条码标签
          </button>
        </div>
      </section>
      <div className="c-inventory-top">
        <div className="c-search">
          <Search />
          <input
            name="productSearch"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
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
            : `左滑可删除 · ${products.data?.items.length ?? 0} 项结果`}
        </small>
      </div>
      {products.isLoading && <div className="catalog-state">正在加载商品…</div>}
      {products.isError && (
        <div className="catalog-state error">加载失败，请检查服务后重试。</div>
      )}
      <section className="c-product-list">
        {products.data?.items.map((p, i) => (
          <SwipeableProductItem
            key={p.id}
            product={p}
            index={i}
            onEdit={setEditing}
            onPrintBarcode={(prod) => setBarcodePrintProducts([prod])}
            onDelete={(prod) => setDeletingProduct(prod)}
          />
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
      <ProductBarcodePrintDialog
        open={Boolean(barcodePrintProducts)}
        initialProducts={barcodePrintProducts ?? []}
        allProducts={products.data?.items ?? []}
        onClose={() => setBarcodePrintProducts(null)}
      />

      {deletingProduct &&
        createPortal(
          <div
            className="catalog-dialog-backdrop"
            onClick={() => setDeletingProduct(null)}
            role="presentation"
          >
            <div
              className="catalog-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-product-title"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "420px" }}
            >
              <header>
                <div>
                  <small style={{ color: "#dc2626" }}>商品与库存</small>
                  <h2 id="delete-product-title">删除（停用）商品</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingProduct(null)}
                  aria-label="关闭"
                >
                  <X />
                </button>
              </header>
              <div style={{ padding: "18px 22px 14px", display: "grid", gap: "10px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px 14px",
                    border: "1px solid #fee2e2",
                    borderRadius: "12px",
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  <Trash2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ display: "block", color: "#7f1d1d", marginBottom: "2px" }}>
                      确定要删除（停用）该商品吗？
                    </strong>
                    <span>
                      商品「<strong>{deletingProduct.name}</strong>」将被标记为停用状态，历史出入库与单据流水不受影响。
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "#f8faf9",
                    border: "1px solid #e8ede9",
                    fontSize: "11px",
                    color: "#526258",
                    display: "grid",
                    gap: "4px",
                  }}
                >
                  <div><strong>编码：</strong>{deletingProduct.code}</div>
                  {deletingProduct.model && <div><strong>型号：</strong>{deletingProduct.model}</div>}
                  <div><strong>分类：</strong>{deletingProduct.category.name}</div>
                </div>
              </div>
              <footer>
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setDeletingProduct(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  style={{
                    minHeight: "38px",
                    padding: "0 18px",
                    border: "0",
                    borderRadius: "10px",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    boxShadow: "0 4px 14px rgba(220, 38, 38, 0.22)",
                    cursor: "pointer",
                  }}
                  disabled={setProductStatus.isPending}
                  onClick={async () => {
                    try {
                      await setProductStatus.mutateAsync({
                        product: deletingProduct,
                        status: "INACTIVE",
                      });
                      setDeletingProduct(null);
                    } catch (err) {
                      console.error("Failed to deactivate product", err);
                    }
                  }}
                >
                  {setProductStatus.isPending ? "正在处理…" : "确认删除"}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
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
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const [statementCustomerId, setStatementCustomerId] = useState<string | null>(
    null,
  );
  const [statementSupplierId, setStatementSupplierId] = useState<string | null>(
    null,
  );
  const parties = useParties(search, role);

  const filteredItems = parties.data?.items || [];

  return (
    <>
      <CPageHead
        eyebrow="基础资料"
        title="客户与供应商档案"
        description="支持信用额度、账期管理与批量导入导出。"
      />
      <div className="c-inventory-top">
        <div className="c-search">
          <Search />
          <input
            name="partySearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜单位名称、联系人或电话"
          />
        </div>
      </div>

      <div className="c-mobile-toolbar-actions">
        <button
          type="button"
          className="c-sub-btn"
          onClick={() => setBatchImporting(true)}
        >
          <FileSpreadsheet size={14} />
          批量导入
        </button>
        <button
          type="button"
          className="c-sub-btn"
          onClick={() => exportPartiesToCsv(filteredItems)}
          disabled={filteredItems.length === 0}
        >
          <Download size={14} />
          导出表格
        </button>
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
        {filteredItems.map((p, i) => {
          const c = p.contacts?.find((x) => x.isPrimary) ?? p.contacts?.[0];
          const hasCredit = Number(p.creditLimit || 0) > 0;
          return (
            <article key={p.id} onClick={() => setEditingParty(p)}>
              <span className={`c-party-avatar tone-${i % 4}`}>
                {p.name.slice(0, 1)}
              </span>
              <div>
                <div className="c-party-tags">
                  {(p.roles || [(p as any).role || "CUSTOMER"]).map((r) => (
                    <span key={r}>{r === "CUSTOMER" ? "客户" : "供应商"}</span>
                  ))}
                  {hasCredit && (
                    <span className="credit-tag">
                      授信 ¥{Number(p.creditLimit).toLocaleString("zh-CN")}
                    </span>
                  )}
                  {p.status === "INACTIVE" && (
                    <span className="inactive">已停用</span>
                  )}
                </div>
                <strong>{p.name}</strong>
                <small>
                  {p.code}
                  {c
                    ? ` · ${c.name}${c.phone || (p as any).phone ? ` ${c.phone || (p as any).phone}` : ""}`
                    : " · 暂无联系人"}
                </small>
                <p>
                  <span>
                    {hasCredit
                      ? `额度 ¥${Number(p.creditLimit).toLocaleString("zh-CN")}`
                      : "现结 (无授信额度)"}
                  </span>
                  <span>
                    {p.paymentTermsDays
                      ? `${p.paymentTermsDays} 天账期`
                      : "即时结清"}
                  </span>
                </p>
              </div>
              <div
                className="c-party-actions-wrap"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="c-party-edit-icon"
                  aria-label={`编辑${p.name}`}
                  onClick={() => setEditingParty(p)}
                >
                  <Pencil size={15} />
                </button>
                {(p.roles?.includes("CUSTOMER") ||
                  (p as any).role === "CUSTOMER") && (
                  <button
                    aria-label={`查看${p.name}的客户对账单`}
                    onClick={() => setStatementCustomerId(p.id)}
                    title="客户对账单"
                  >
                    <ReceiptText aria-hidden="true" />
                  </button>
                )}
                {(p.roles?.includes("SUPPLIER") ||
                  (p as any).role === "SUPPLIER") && (
                  <button
                    className="c-supplier-stmt-btn"
                    aria-label={`查看${p.name}的供应商对账单`}
                    onClick={() => setStatementSupplierId(p.id)}
                    title="供应商对账与付款结算"
                  >
                    <Banknote size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
      {filteredItems.length === 0 && (
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
      <EditPartyDialog
        party={editingParty}
        open={!!editingParty}
        onClose={() => setEditingParty(null)}
      />
      <BatchImportPartiesDialog
        open={batchImporting}
        onClose={() => setBatchImporting(false)}
      />
      {statementCustomerId && (
        <Suspense fallback={null}>
          <CustomerStatementDialog
            open
            initialCustomerId={statementCustomerId}
            onClose={() => setStatementCustomerId(null)}
          />
        </Suspense>
      )}
      {statementSupplierId && (
        <Suspense fallback={null}>
          <SupplierStatementDialog
            open
            initialSupplierId={statementSupplierId}
            onClose={() => setStatementSupplierId(null)}
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
