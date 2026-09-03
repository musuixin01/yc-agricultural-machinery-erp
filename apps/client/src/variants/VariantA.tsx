import {
  Bell,
  Box,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Cloud,
  Download,
  Barcode,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  PackageCheck,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Store,
  Tractor,
  TrendingUp,
  Truck,
  Upload,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { activities, debts, metrics, type Screen } from "../mockData";
import { lazy, Suspense, useState } from "react";
import { CreateProductDialog } from "../modules/catalog/CreateProductDialog";
import { EditProductDialog } from "../modules/catalog/EditProductDialog";
import { ProductBarcodePrintDialog } from "../modules/catalog/ProductBarcodePrintDialog";
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
import { useParties, useSetPartyStatus } from "../modules/parties/use-parties";
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

const nav = [
  ["dashboard", "工作台", LayoutDashboard],
  ["sales", "销售开单", ShoppingCart],
  ["inventory", "商品资料", Box],
  ["debts", "客户欠款", WalletCards],
] as const;

export function VariantA({ screen, onScreenChange }: Props) {
  const auth = useAuth();
  return (
    <div className="a-shell">
      <aside className="a-sidebar">
        <div className="a-brand">
          <span className="a-brandmark">YC</span>
          <div>
            <strong>玉春农机</strong>
            <small>YC BUSINESS</small>
          </div>
        </div>
        <nav className="a-nav">
          <p>经营管理</p>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={screen === key ? "active" : ""}
              onClick={() => onScreenChange(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {key === "debts" && <em>4</em>}
            </button>
          ))}
          <p>业务协作</p>
          <button
            className={screen === "purchasing" ? "active" : ""}
            onClick={() => onScreenChange("purchasing")}
          >
            <Truck size={18} />
            <span>采购入库</span>
          </button>
          <button
            className={screen === "payables" ? "active" : ""}
            onClick={() => onScreenChange("payables")}
          >
            <CircleDollarSign size={18} />
            <span>付供应商款</span>
          </button>
          <button
            className={screen === "stock" ? "active" : ""}
            onClick={() => onScreenChange("stock")}
          >
            <PackageCheck size={18} />
            <span>库存账本</span>
          </button>
          <button
            className={screen === "warehouses" ? "active" : ""}
            onClick={() => onScreenChange("warehouses")}
          >
            <Store size={18} />
            <span>仓库管理</span>
          </button>
          <button
            className={screen === "parties" ? "active" : ""}
            onClick={() => onScreenChange("parties")}
          >
            <UsersRound size={18} />
            <span>客户供应商</span>
          </button>
          <button>
            <TrendingUp size={18} />
            <span>经营报表</span>
          </button>
        </nav>
        <div className="a-sidebar-foot">
          <div className="a-cloud">
            <Cloud size={16} />
            <span>
              <strong>云端账本正常</strong>
              <small>刚刚完成同步</small>
            </span>
          </div>
          <button
            className={screen === "staff" ? "active" : ""}
            onClick={() => onScreenChange("staff")}
          >
            <Settings size={18} />
            系统设置
          </button>
        </div>
      </aside>
      <main className="a-main">
        <header className="a-topbar">
          <button className="a-mobile-menu">
            <Menu size={20} />
          </button>
          <div className="a-search">
            <Search size={18} />
            <input
              name="globalSearch"
              aria-label="全局搜索"
              placeholder="搜索商品、客户、单据..."
            />
            <kbd>Ctrl K</kbd>
          </div>
          <div className="a-top-actions">
            <button className="icon-button">
              <Bell size={19} />
              <i />
            </button>
            <button
              className="a-user"
              onClick={() => onScreenChange("staff")}
              title="账号与权限"
            >
              <span>{auth.user.displayName.slice(0, 1)}</span>
              <div>
                <strong>{auth.user.displayName}</strong>
                <small>经营者</small>
              </div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <div className="a-content">
          {screen === "dashboard" && (
            <DashboardWorkspace
              layout="desktop"
              onScreenChange={onScreenChange}
            />
          )}
          {screen === "sales" && <SalesWorkspace layout="desktop" />}
          {screen === "purchasing" && (
            <PurchasingWorkspace
              layout="desktop"
              onOpenPayables={() => onScreenChange("payables")}
            />
          )}
          {screen === "payables" && <PayablesWorkspace layout="desktop" />}
          {screen === "inventory" && <AInventory />}
          {screen === "stock" && <InventoryLedger layout="desktop" />}
          {screen === "warehouses" && <AWarehouses />}
          {screen === "staff" && <IdentityManagement layout="desktop" />}
          {screen === "parties" && <AParties />}
          {screen === "debts" && <ReceivablesWorkspace layout="desktop" />}
        </div>
      </main>
      <nav className="a-mobile-nav">
        {nav.map(([key, label, Icon]) => (
          <button
            key={key}
            className={screen === key ? "active" : ""}
            onClick={() => onScreenChange(key)}
          >
            <Icon size={19} />
            <span>{label.slice(0, 2)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function AWarehouses() {
  const [search, setSearch] = useState("");
  const [warehouseStatus, setWarehouseStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const warehouses = useWarehouses(search, warehouseStatus);
  const setStatus = useSetWarehouseStatus();
  const setDefault = useSetDefaultWarehouse();
  const pending = setStatus.isPending || setDefault.isPending;
  const defaultWarehouse = warehouses.data?.items.find(
    (item) => item.isDefault,
  );

  return (
    <div className="warehouse-page-a">
      <section className="warehouse-hero-a">
        <div>
          <span>库存基础资料 · 仓库与库位</span>
          <h1>仓库管理</h1>
          <p>先把货放在哪里管清楚，再进入可追溯的出入库和库存账。</p>
        </div>
        <div className="warehouse-hero-summary">
          <span>
            <small>仓库总数</small>
            <strong>{warehouses.data?.total ?? "—"}</strong>
          </span>
          <span>
            <small>默认仓库</small>
            <strong>{defaultWarehouse?.name ?? "未设置"}</strong>
          </span>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus size={17} />
          新增仓库
        </button>
      </section>
      <section className="a-panel warehouse-workspace">
        <header className="catalog-toolbar-a">
          <div className="catalog-search-a">
            <Search size={18} />
            <input
              name="warehouseSearch"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索仓库、编码、地址或库位"
            />
          </div>
          <div className="catalog-status-filter" aria-label="仓库状态">
            {[
              ["", "全部"],
              ["ACTIVE", "启用"],
              ["INACTIVE", "停用"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={warehouseStatus === value ? "active" : ""}
                onClick={() => setWarehouseStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        {warehouses.isLoading && (
          <div className="catalog-state">正在加载仓库…</div>
        )}
        {warehouses.isError && (
          <div className="catalog-state error">
            仓库加载失败，请确认服务已启动。
            <button onClick={() => warehouses.refetch()}>重试</button>
          </div>
        )}
        <div className="warehouse-grid-a">
          {warehouses.data?.items.map((warehouse) => (
            <article key={warehouse.id}>
              <header>
                <span className="warehouse-icon">
                  <Store size={22} />
                </span>
                <div>
                  <div className="warehouse-title-line">
                    <strong>{warehouse.name}</strong>
                    {warehouse.isDefault && <em>默认仓</em>}
                  </div>
                  <small>{warehouse.code}</small>
                </div>
                <span
                  className={`status-dot ${warehouse.status === "ACTIVE" ? "ok" : "off"}`}
                >
                  {warehouse.status === "ACTIVE" ? "启用" : "停用"}
                </span>
              </header>
              <p className="warehouse-address">
                {warehouse.address || "尚未填写仓库地址"}
              </p>
              <div className="warehouse-location-list">
                <span>库位 {warehouse.locations.length}</span>
                {warehouse.locations.slice(0, 4).map((location) => (
                  <b key={location.id}>{location.name}</b>
                ))}
                {warehouse.locations.length > 4 && (
                  <b>+{warehouse.locations.length - 4}</b>
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
                  title={
                    warehouse.isDefault ? "请先设置其他默认仓库" : undefined
                  }
                >
                  {warehouse.status === "ACTIVE" ? "停用" : "重新启用"}
                </button>
              </footer>
            </article>
          ))}
        </div>
        {warehouses.data?.items.length === 0 && (
          <div className="catalog-state warehouse-empty">
            <strong>还没有仓库</strong>
            <span>建立第一个仓库和库位，后续进销存单据才有明确去向。</span>
            <button
              className="primary-button"
              onClick={() => setCreating(true)}
            >
              新增第一个仓库
            </button>
          </div>
        )}
      </section>
      <CreateWarehouseDialog
        open={creating}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="a-intro">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}

function ADashboard({
  onScreenChange,
}: {
  onScreenChange: (screen: Screen) => void;
}) {
  return (
    <>
      <PageIntro
        eyebrow="2026 年 8 月 12 日 · 星期三"
        title="早上好，白老板"
        description="门店经营正常，今天有 3 项需要您关注。"
        action={
          <button
            className="primary-button"
            onClick={() => onScreenChange("sales")}
          >
            <Plus size={17} />
            新建销售单
          </button>
        }
      />
      <section className="a-metrics">
        {metrics.map((item, index) => (
          <article key={item.label}>
            <div className={`metric-icon ${item.tone}`}>
              {
                [
                  <CircleDollarSign />,
                  <PackageCheck />,
                  <WalletCards />,
                  <Box />,
                ][index]
              }
            </div>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <small className={item.tone}>{item.delta}</small>
          </article>
        ))}
      </section>
      <section className="a-dashboard-grid">
        <article className="a-panel a-chart-panel">
          <div className="panel-heading">
            <div>
              <h2>经营趋势</h2>
              <p>近 7 天销售与收款</p>
            </div>
            <select>
              <option>近 7 天</option>
            </select>
          </div>
          <div className="a-chart">
            <div className="chart-y">
              <span>20k</span>
              <span>15k</span>
              <span>10k</span>
              <span>5k</span>
              <span>0</span>
            </div>
            <div className="chart-area">
              <svg viewBox="0 0 640 210" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="fillA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3d7d55" stopOpacity=".25" />
                    <stop offset="1" stopColor="#3d7d55" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="fill"
                  d="M0 170 C70 145 85 80 150 112 S240 155 305 95 S390 125 455 52 S550 102 640 25 L640 210 L0 210Z"
                />
                <path
                  className="line"
                  d="M0 170 C70 145 85 80 150 112 S240 155 305 95 S390 125 455 52 S550 102 640 25"
                />
                <path
                  className="line secondary"
                  d="M0 185 C65 170 90 130 150 150 S245 115 305 132 S390 90 455 112 S550 70 640 82"
                />
              </svg>
              <div className="chart-labels">
                <span>8/06</span>
                <span>8/07</span>
                <span>8/08</span>
                <span>8/09</span>
                <span>8/10</span>
                <span>8/11</span>
                <span>今天</span>
              </div>
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="sales-dot" />
              销售额 ¥96,780
            </span>
            <span>
              <i className="pay-dot" />
              收款额 ¥78,240
            </span>
          </div>
        </article>
        <article className="a-panel">
          <div className="panel-heading">
            <div>
              <h2>欠款提醒</h2>
              <p>优先联系即将或已经逾期客户</p>
            </div>
            <button
              className="text-button"
              onClick={() => onScreenChange("debts")}
            >
              查看全部
            </button>
          </div>
          <div className="a-debt-list">
            {debts.slice(0, 3).map((d) => (
              <div key={d.name}>
                <span className={`debt-avatar ${d.level}`}>
                  {d.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{d.name}</strong>
                  <small>{d.due}</small>
                </div>
                <b>{d.amount}</b>
              </div>
            ))}
          </div>
        </article>
        <article className="a-panel a-activity">
          <div className="panel-heading">
            <div>
              <h2>经营动态</h2>
              <p>门店最新业务记录</p>
            </div>
            <button className="icon-button">
              <ClipboardList size={18} />
            </button>
          </div>
          {activities.map((a) => (
            <div className="activity-row" key={a.time}>
              <time>{a.time}</time>
              <i className={a.type} />
              <div>
                <strong>{a.title}</strong>
                <small>{a.meta}</small>
              </div>
            </div>
          ))}
        </article>
        <article className="a-panel a-quick">
          <div className="panel-heading">
            <div>
              <h2>快捷操作</h2>
              <p>高频业务一步直达</p>
            </div>
          </div>
          <div className="quick-grid">
            <button
              onClick={() => {
                sessionStorage.setItem("yc-sales-entry-mode", "scan");
                onScreenChange("sales");
              }}
            >
              <ScanLine />
              <span>
                <strong>扫码开单</strong>
                <small>快速销售</small>
              </span>
            </button>
            <button onClick={() => onScreenChange("purchasing")}>
              <Truck />
              <span>
                <strong>采购入库</strong>
                <small>到货登记</small>
              </span>
            </button>
            <button onClick={() => onScreenChange("inventory")}>
              <Box />
              <span>
                <strong>库存盘点</strong>
                <small>录入实盘</small>
              </span>
            </button>
            <button onClick={() => onScreenChange("debts")}>
              <CircleDollarSign />
              <span>
                <strong>向客户收款</strong>
                <small>客户欠款减少</small>
              </span>
            </button>
          </div>
        </article>
      </section>
    </>
  );
}

function AInventory() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productStatus, setProductStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [barcodePrintProducts, setBarcodePrintProducts] = useState<
    Product[] | null
  >(null);
  const products = useProducts(search, categoryId, productStatus);
  const references = useCatalogReferences();
  const status = useSetProductStatus();
  return (
    <div className="catalog-page catalog-page-a">
      <section className="catalog-hero-a">
        <div className="catalog-hero-copy">
          <span className="catalog-breadcrumb">基础资料 · 商品中心</span>
          <h1>商品资料</h1>
          <p>统一管理整机、配件、螺丝和耗材，让开单查货更快一步。</p>
        </div>
        <div className="catalog-hero-stats" aria-label="商品资料概览">
          <span>
            <small>当前结果</small>
            <strong>{products.data?.total ?? "—"}</strong>
          </span>
          <span>
            <small>商品分类</small>
            <strong>{references.data?.categories.length ?? "—"}</strong>
          </span>
          <span>
            <small>数据状态</small>
            <strong className="catalog-live">
              <i />
              实时
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="outline-button inline-flex items-center gap-1.5 text-xs py-2 px-3.5 rounded-lg border-emerald-600 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold shadow-sm transition-all"
            onClick={() => setBarcodePrintProducts(products.data?.items ?? [])}
            title="一键将当前商品列表批量生成条码/二维码标签"
          >
            <Barcode size={16} className="text-emerald-700" />
            批量条码标签打印
          </button>
          <button
            className="primary-button catalog-add"
            onClick={() => setCreating(true)}
          >
            <Plus size={17} />
            新增商品
          </button>
        </div>
      </section>
      <section className="a-panel table-panel catalog-workspace">
        <header className="catalog-toolbar-a">
          <div className="catalog-search-a">
            <Search size={18} />
            <input
              name="productSearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索商品名称、编码、型号或条码"
            />
            <kbd>Enter</kbd>
          </div>
          <select
            className="filter-button catalog-category-select"
            aria-label="商品分类"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">全部分类</option>
            {references.data?.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="catalog-status-filter" aria-label="商品状态">
            {[
              ["", "全部"],
              ["ACTIVE", "在售"],
              ["INACTIVE", "停用"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={productStatus === value ? "active" : ""}
                aria-pressed={productStatus === value}
                onClick={() => setProductStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="catalog-result-line">
          <span>商品清单</span>
          <small>
            {products.isFetching
              ? "正在更新…"
              : `当前显示 ${products.data?.items.length ?? 0} 项`}
          </small>
        </div>
        {products.isLoading && (
          <div className="catalog-state">正在加载商品…</div>
        )}
        {products.isError && (
          <div className="catalog-state error">
            商品加载失败，请确认后端服务已启动。
            <button onClick={() => products.refetch()}>重试</button>
          </div>
        )}
        {products.data && (
          <div className="responsive-table">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>商品</th>
                  <th>分类 / 品牌</th>
                  <th>型号规格</th>
                  <th>安全库存</th>
                  <th>零售价</th>
                  <th>状态</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {products.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <span
                          className={`catalog-product-icon type-${p.type.toLowerCase()}`}
                        >
                          <Tractor size={20} />
                        </span>
                        <div>
                          <strong>{p.name}</strong>
                          <small>
                            {p.code}
                            {p.barcodes[0] ? ` · ${p.barcodes[0].barcode}` : ""}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.category.name}
                      {p.brand ? ` / ${p.brand.name}` : ""}
                    </td>
                    <td>
                      {[p.model, p.specification].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td>
                      {Number(p.safetyStock)} {p.baseUnit.name}
                    </td>
                    <td className="catalog-price">
                      ¥{" "}
                      {Number(p.retailPrice).toLocaleString("zh-CN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <button
                        className={`status-pill ${p.status === "ACTIVE" ? "ok" : "low"}`}
                        disabled={status.isPending}
                        onClick={() =>
                          status.mutate({
                            product: p,
                            status:
                              p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          })
                        }
                      >
                        {p.status === "ACTIVE" ? "在售" : "已停用"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="catalog-edit-button text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          onClick={() => setBarcodePrintProducts([p])}
                          title={`打印 ${p.name} 条码标签`}
                        >
                          <Barcode size={15} />
                          打标
                        </button>
                        <button
                          className="catalog-edit-button"
                          onClick={() => setEditing(p)}
                          aria-label={`编辑 ${p.name}`}
                        >
                          <Pencil size={15} />
                          编辑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.data.items.length === 0 && (
              <div className="catalog-state">没有找到匹配商品</div>
            )}
          </div>
        )}
      </section>
      <CreateProductDialog open={creating} onClose={() => setCreating(false)} />
      <EditProductDialog product={editing} onClose={() => setEditing(null)} />
      <ProductBarcodePrintDialog
        open={Boolean(barcodePrintProducts)}
        initialProducts={barcodePrintProducts ?? []}
        allProducts={products.data?.items ?? []}
        onClose={() => setBarcodePrintProducts(null)}
      />
    </div>
  );
}

function AParties() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creditFilter, setCreditFilter] = useState("");
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
  const status = useSetPartyStatus();

  const roleText = (roles: string[]) =>
    roles.length === 2
      ? "客户 · 供应商"
      : roles[0] === "CUSTOMER"
        ? "客户"
        : "供应商";

  // Filter items by status and credit type client-side if selected
  const filteredItems = (parties.data?.items || []).filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (creditFilter === "CREDIT" && Number(p.creditLimit || 0) <= 0)
      return false;
    if (creditFilter === "CASH" && Number(p.creditLimit || 0) > 0) return false;
    return true;
  });

  return (
    <>
      <PageIntro
        eyebrow="基础资料 / 往来单位"
        title="客户与供应商档案"
        description={
          parties.data
            ? `共 ${parties.data.total} 位往来单位档案，支持信用额度、账期风控与批量数据导入导出。`
            : "正在读取往来单位…"
        }
        action={
          <div className="table-actions-group">
            <button
              className="outline-button"
              onClick={() => setBatchImporting(true)}
              title="批量导入客户或供应商档案"
            >
              <FileSpreadsheet size={16} />
              批量导入
            </button>
            <button
              className="outline-button"
              onClick={() => exportPartiesToCsv(filteredItems)}
              disabled={filteredItems.length === 0}
              title="导出当前筛选结果为 CSV 表格"
            >
              <Download size={16} />
              导出表格
            </button>
            <button
              className="primary-button"
              onClick={() => setCreating(true)}
            >
              <Plus size={17} />
              新增往来单位
            </button>
          </div>
        }
      />
      <section className="a-panel table-panel">
        <div className="table-toolbar">
          <div className="a-search">
            <Search size={18} />
            <input
              name="partySearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索单位名称、编码、简称、联系人、电话"
            />
          </div>
          <select
            className="filter-button"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">全部业务身份</option>
            <option value="CUSTOMER">客户</option>
            <option value="SUPPLIER">供应商</option>
          </select>
          <select
            className="filter-button"
            value={creditFilter}
            onChange={(e) => setCreditFilter(e.target.value)}
          >
            <option value="">全部结算类型</option>
            <option value="CREDIT">有授信额度</option>
            <option value="CASH">现结单位 (无额度)</option>
          </select>
          <select
            className="filter-button"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="ACTIVE">正常合作中</option>
            <option value="INACTIVE">已停用</option>
          </select>
        </div>
        {parties.isLoading && (
          <div className="catalog-state">正在加载往来单位…</div>
        )}
        {parties.isError && (
          <div className="catalog-state error">
            加载失败，请确认后端服务已启动。
            <button onClick={() => parties.refetch()}>重试</button>
          </div>
        )}
        {parties.data && (
          <div className="responsive-table">
            <table className="party-table">
              <thead>
                <tr>
                  <th>往来单位</th>
                  <th>身份</th>
                  <th>主要联系人</th>
                  <th>信用额度</th>
                  <th>默认账期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((p) => {
                  const c =
                    p.contacts?.find((x) => x.isPrimary) ?? p.contacts?.[0];
                  const hasCredit = Number(p.creditLimit || 0) > 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="table-product">
                          <span className="party-avatar">
                            <UsersRound size={18} />
                          </span>
                          <div>
                            <strong>{p.name}</strong>
                            <small>
                              {p.code}
                              {p.shortName ? ` · ${p.shortName}` : ""}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="party-role-pill">
                          {roleText(p.roles || [(p as any).role || "CUSTOMER"])}
                        </span>
                      </td>
                      <td>
                        {c ? (
                          <>
                            <b className="party-contact-name">{c.name}</b>
                            <small className="party-contact-phone">
                              {c.phone || (p as any).phone || "未填写电话"}
                            </small>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            hasCredit
                              ? "party-credit-active"
                              : "party-credit-zero"
                          }
                        >
                          ¥{" "}
                          {Number(p.creditLimit || 0).toLocaleString("zh-CN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        {hasCredit && (
                          <small className="party-credit-hint">已授信</small>
                        )}
                      </td>
                      <td>
                        <span className="party-terms-badge">
                          {p.paymentTermsDays
                            ? `${p.paymentTermsDays} 天账期`
                            : "现结 (无账期)"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`status-pill ${p.status === "ACTIVE" ? "ok" : "low"}`}
                          disabled={status.isPending}
                          onClick={() =>
                            status.mutate({
                              party: p,
                              status:
                                p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            })
                          }
                        >
                          {p.status === "ACTIVE" ? "正常" : "已停用"}
                        </button>
                      </td>
                      <td>
                        <div className="party-actions-cell">
                          <button
                            type="button"
                            className="party-edit-button"
                            onClick={() => setEditingParty(p)}
                          >
                            <Pencil size={13} />
                            编辑
                          </button>
                          {(p.roles?.includes("CUSTOMER") ||
                            (p as any).role === "CUSTOMER") && (
                            <button
                              type="button"
                              className="party-statement-button"
                              onClick={() => setStatementCustomerId(p.id)}
                              title="查看客户应收对账单"
                            >
                              客户对账
                            </button>
                          )}
                          {(p.roles?.includes("SUPPLIER") ||
                            (p as any).role === "SUPPLIER") && (
                            <button
                              type="button"
                              className="party-statement-button supplier-statement-btn"
                              onClick={() => setStatementSupplierId(p.id)}
                              title="查看供应商应付对账单及付款结算"
                            >
                              供应商对账
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="catalog-state">
                <strong>没有匹配的往来单位</strong>
                <br />
                可调整搜索条件、筛选标签，或点击上方“新增往来单位 / 批量导入”。
              </div>
            )}
          </div>
        )}
      </section>
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

function ADebts() {
  return (
    <>
      <PageIntro
        eyebrow="往来账 / 客户欠款"
        title="客户欠款"
        description="这里记录客户尚未结清的货款；登记收款并核销后，欠款余额相应减少。"
        action={
          <button className="primary-button">
            <Plus size={17} />
            收客户款
          </button>
        }
      />
      <div className="debt-summary">
        <article>
          <span>客户欠款</span>
          <strong>¥ 86,420</strong>
          <small>26 位欠款客户</small>
        </article>
        <article className="late">
          <span>已逾期</span>
          <strong>¥ 18,960</strong>
          <small>需要优先跟进</small>
        </article>
        <article>
          <span>30 天内到期</span>
          <strong>¥ 35,240</strong>
          <small>12 笔未结销售单</small>
        </article>
      </div>
      <section className="a-panel debt-table">
        <div className="table-toolbar">
          <div className="a-search">
            <Search size={18} />
            <input placeholder="搜索客户名称或手机号" />
          </div>
          <button className="filter-button">
            全部账龄
            <ChevronDown size={15} />
          </button>
        </div>
        {debts.map((d) => (
          <div className="debt-row" key={d.name}>
            <span className={`debt-avatar ${d.level}`}>
              {d.name.slice(0, 1)}
            </span>
            <div>
              <strong>{d.name}</strong>
              <small>{d.contact}</small>
            </div>
            <span className={`due-text ${d.level}`}>{d.due}</span>
            <b>{d.amount}</b>
            <button className="outline-button">查看对账</button>
          </div>
        ))}
      </section>
    </>
  );
}
