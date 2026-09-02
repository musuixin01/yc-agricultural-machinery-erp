import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  HardDrive,
  RefreshCw,
  ScanLine,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";
import type { Screen } from "../../mockData";
import { useAuth } from "../auth/AuthGate";
import { useBackupPolicy } from "../administration/use-administration";
import type { DashboardPeriod } from "./dashboard-api";
import { useDashboard } from "./use-dashboard";

const periodLabels: Record<DashboardPeriod, string> = {
  TODAY: "今天",
  LAST_7_DAYS: "近 7 天",
  THIS_MONTH: "本月",
};

function money(value: string) {
  return `¥${Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function smoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];
    const c1x = current.x + (next.x - previous.x) / 6;
    const c1y = current.y + (next.y - previous.y) / 6;
    const c2x = next.x - (afterNext.x - current.x) / 6;
    const c2y = next.y - (afterNext.y - current.y) / 6;
    path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return path;
}

export function DashboardWorkspace({
  layout,
  onScreenChange,
}: {
  layout: "desktop" | "mobile";
  onScreenChange: (screen: Screen) => void;
}) {
  const auth = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("TODAY");
  const query = useDashboard(period);
  const canManageBackups = auth.user.permissions.includes(
    "administration.manage",
  );
  const backupPolicy = useBackupPolicy(canManageBackups);
  const data = query.data;
  const maxTrend = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.trend.flatMap((item) => [
          Math.abs(Number(item.salesNet)),
          Math.abs(Number(item.salesGross)),
        ]) ?? [1]),
      ),
    [data?.trend],
  );
  const trendInfo = useMemo(() => {
    if (!data || data.trend.length < 2) return null;
    const previous = Number(data.trend.at(-2)?.salesNet ?? 0);
    const current = Number(data.trend.at(-1)?.salesNet ?? 0);
    if (previous === 0) {
      return current === 0
        ? { direction: "flat", label: "与昨日持平" }
        : { direction: current > 0 ? "up" : "down", label: "较昨日新增" };
    }
    const percentage = Math.abs(
      ((current - previous) / Math.abs(previous)) * 100,
    );
    return {
      direction:
        current === previous ? "flat" : current > previous ? "up" : "down",
      label:
        current === previous
          ? "与昨日持平"
          : `较昨日 ${percentage.toFixed(1)}%`,
    };
  }, [data]);

  if (query.isLoading) {
    return (
      <div className={`real-dashboard dashboard-${layout}`}>
        <div className="dashboard-loading">
          <span className="dashboard-loading-mark">YC</span>
          <strong>正在核对经营账本…</strong>
          <small>销售、欠款、库存和资金正在汇总</small>
        </div>
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <div className={`real-dashboard dashboard-${layout}`}>
        <div className="dashboard-error">
          <AlertTriangle aria-hidden="true" />
          <strong>暂时无法读取经营数据</strong>
          <span>
            {query.error instanceof Error
              ? query.error.message
              : "请检查服务连接后重试。"}
          </span>
          <button onClick={() => void query.refetch()}>
            <RefreshCw aria-hidden="true" />
            重新读取
          </button>
        </div>
      </div>
    );
  }

  const flowLabel = period === "TODAY" ? "今日" : periodLabels[period];
  const hasBackupFailure = Boolean(
    backupPolicy.data?.lastFailureAt ||
    (backupPolicy.data?.secondaryCopyEnabled &&
      backupPolicy.data.lastSecondaryCopyFailureAt),
  );
  const attentionCount =
    data.receivables.overdueCount +
    data.inventory.lowStockProductCount +
    (hasBackupFailure ? 1 : 0);
  const trendHasActivity = data.trend.some((item) =>
    [
      item.salesGross,
      item.salesReturns,
      item.salesReversals,
      item.salesNet,
    ].some((value) => Number(value) !== 0),
  );
  const pointFor = (value: string, index: number) => ({
    x:
      data.trend.length === 1
        ? 300
        : (index / Math.max(1, data.trend.length - 1)) * 600,
    y: 172 - (Math.max(0, Number(value)) / maxTrend) * 145,
  });
  const netPoints = data.trend.map((item, index) =>
    pointFor(item.salesNet, index),
  );
  const grossPoints = data.trend.map((item, index) =>
    pointFor(item.salesGross, index),
  );
  const netPath = smoothLinePath(netPoints);
  const grossPath = smoothLinePath(grossPoints);
  const areaPath =
    data.trend.length > 1 ? `${netPath} L 600 182 L 0 182 Z` : "";
  const trendLabelIndexes =
    data.trend.length <= 7
      ? data.trend.map((_, index) => index)
      : [
          0,
          Math.floor((data.trend.length - 1) / 4),
          Math.floor((data.trend.length - 1) / 2),
          Math.floor(((data.trend.length - 1) * 3) / 4),
          data.trend.length - 1,
        ];
  const openScanSale = () => {
    sessionStorage.setItem("yc-sales-entry-mode", "scan");
    onScreenChange("sales");
  };

  return (
    <div className={`real-dashboard dashboard-${layout} yc-unified-dashboard`}>
      <section className="dashboard-head yc-dashboard-head">
        <div>
          <span>
            {new Intl.DateTimeFormat("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            }).format(new Date())}
          </span>
          <h1>你好，{auth.user.displayName}</h1>
          <p>
            {attentionCount > 0
              ? `有 ${attentionCount} 项经营事项需要关注。`
              : "门店经营正常，暂时没有紧急事项。"}
          </p>
        </div>
        <button
          className="dashboard-sale-button"
          onClick={() => onScreenChange("sales")}
        >
          <ShoppingCart aria-hidden="true" />
          销售开单
        </button>
      </section>

      <section className="yc-priority-section">
        <article className="yc-dashboard-panel yc-reminders">
          <header>
            <div>
              <h2>待办提醒</h2>
              <p>需要优先处理的经营事项</p>
            </div>
            <span>{attentionCount}</span>
          </header>
          <div className="yc-reminder-list">
            {hasBackupFailure && (
              <button
                onClick={() => {
                  sessionStorage.setItem("yc-settings-tab", "backups");
                  onScreenChange("staff");
                }}
              >
                <span className="todo-icon red">
                  <HardDrive aria-hidden="true" />
                </span>
                <div>
                  <strong>数据备份需要处理</strong>
                  <small>
                    {backupPolicy.data?.lastSecondaryCopyFailureAt
                      ? "第二存储复制失败，点击查看原因"
                      : "自动备份失败，点击查看原因"}
                  </small>
                </div>
                <ChevronRight aria-hidden="true" />
              </button>
            )}
            {data.receivables.overdueCount > 0 && (
              <button onClick={() => onScreenChange("debts")}>
                <span className="todo-icon red">
                  <Clock3 />
                </span>
                <div>
                  <strong>
                    {data.receivables.overdueCount} 笔客户欠款已逾期
                  </strong>
                  <small>合计 {money(data.receivables.overdueAmount)}</small>
                </div>
                <ChevronRight />
              </button>
            )}
            {data.inventory.lowStockProductCount > 0 && (
              <button onClick={() => onScreenChange("stock")}>
                <span className="todo-icon orange">
                  <Boxes />
                </span>
                <div>
                  <strong>
                    {data.inventory.lowStockProductCount} 种商品库存偏低
                  </strong>
                  <small>
                    {data.inventory.negativeStockProductCount > 0
                      ? `其中 ${data.inventory.negativeStockProductCount} 种负库存`
                      : "建议检查补货"}
                  </small>
                </div>
                <ChevronRight />
              </button>
            )}
            {attentionCount === 0 && (
              <p className="dashboard-list-empty yc-all-clear">
                目前没有需要紧急处理的事项。
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="c-quick-section yc-quick-section yc-sequence-section">
        <div className="c-section-title">
          <div>
            <h2>常用功能</h2>
            <p>一步完成日常经营</p>
          </div>
        </div>
        <div className="c-actions yc-dashboard-actions">
          <button onClick={openScanSale}>
            <span className="green">
              <ScanLine aria-hidden="true" />
            </span>
            <strong>扫码开单</strong>
            <small>快速销售</small>
          </button>
          <button onClick={() => onScreenChange("purchasing")}>
            <span className="blue">
              <Truck aria-hidden="true" />
            </span>
            <strong>采购入库</strong>
            <small>登记到货</small>
          </button>
          <button onClick={() => onScreenChange("debts")}>
            <span className="amber">
              <CircleDollarSign aria-hidden="true" />
            </span>
            <strong>客户收款</strong>
            <small>核销欠款</small>
          </button>
          <button onClick={() => onScreenChange("stock")}>
            <span className="purple">
              <Boxes aria-hidden="true" />
            </span>
            <strong>查看库存</strong>
            <small>{data.inventory.lowStockProductCount} 项预警</small>
          </button>
        </div>
      </section>

      <section className="yc-sequence-section">
        <article className="yc-dashboard-panel yc-recent-sales yc-recent-sales-wide">
          <header>
            <div>
              <h2>最近销售</h2>
              <p>来自正式销售单</p>
            </div>
            <button onClick={() => onScreenChange("sales")}>
              全部 <ChevronRight />
            </button>
          </header>
          <div className="yc-recent-list">
            {data.recentSales.map((item) => (
              <button
                className="yc-sale-row"
                key={item.id}
                onClick={() => onScreenChange("sales")}
              >
                <span>{item.customerNameSnapshot?.slice(0, 1) || "客"}</span>
                <div>
                  <strong>{item.customerNameSnapshot || "散客"}</strong>
                  <small>
                    {item.documentNumber} ·{" "}
                    {item.status === "REVERSED"
                      ? "已冲销"
                      : item.settlementType === "CREDIT"
                        ? "客户赊账"
                        : "现结"}
                  </small>
                </div>
                <b>{money(item.totalAmount)}</b>
              </button>
            ))}
          </div>
          {data.recentSales.length === 0 && (
            <p className="dashboard-list-empty">还没有正式销售记录。</p>
          )}
        </article>
      </section>

      <section className="yc-sequence-section">
        <article className="yc-dashboard-panel yc-trend-panel yc-trend-wide">
          <header>
            <div>
              <h2>经营趋势</h2>
              <p>{periodLabels[period]}正式销售净额</p>
            </div>
            {trendHasActivity && (
              <div className="yc-chart-legend">
                <span>
                  <i className="net" />
                  净销售
                </span>
                <span>
                  <i className="gross" />
                  销售额
                </span>
              </div>
            )}
          </header>
          {trendHasActivity ? (
            <>
              <div className="yc-trend-summary">
                <strong>{money(data.sales.net)}</strong>
                <span className={trendInfo?.direction ?? "flat"}>
                  {trendInfo?.direction === "up" ? (
                    <TrendingUp aria-hidden="true" />
                  ) : trendInfo?.direction === "down" ? (
                    <TrendingDown aria-hidden="true" />
                  ) : null}
                  {data.trend.length < 2
                    ? `${periodLabels[period]}累计`
                    : (trendInfo?.label ?? "暂无对比")}
                </span>
              </div>
              <div className="yc-light-chart">
                <svg
                  viewBox="0 0 600 190"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${periodLabels[period]}销售净额与销售额折线趋势图`}
                >
                  <defs>
                    <linearGradient
                      id="ycDashboardFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0" stopColor="#3f8a60" stopOpacity=".18" />
                      <stop offset="1" stopColor="#3f8a60" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {areaPath && <path className="yc-chart-area" d={areaPath} />}
                  <path className="yc-chart-line gross" d={grossPath} />
                  <path className="yc-chart-line net" d={netPath} />
                  {data.trend.length <= 7 &&
                    netPoints.map((point, index) => (
                      <circle
                        className="yc-chart-point"
                        key={data.trend[index].date}
                        cx={point.x}
                        cy={point.y}
                        r={data.trend.length === 1 ? 5 : 2.8}
                      />
                    ))}
                </svg>
                <div className="yc-chart-labels">
                  {trendLabelIndexes.map((index) => (
                    <span key={data.trend[index].date}>
                      {shortDate(data.trend[index].date)}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="yc-trend-empty">
              <TrendingUp aria-hidden="true" />
              <strong>{periodLabels[period]}暂无销售记录</strong>
              <small>完成正式销售后，这里会按所选时间范围生成趋势。</small>
            </div>
          )}
        </article>
      </section>

      <section className="yc-bottom-summary" aria-label="期间经营汇总">
        <div className="dashboard-toolbar yc-dashboard-toolbar">
          <div className="dashboard-period" aria-label="统计期间">
            {(Object.keys(periodLabels) as DashboardPeriod[]).map((key) => (
              <button
                key={key}
                className={period === key ? "active" : ""}
                onClick={() => setPeriod(key)}
              >
                {periodLabels[key]}
              </button>
            ))}
          </div>
          <button
            className="dashboard-refresh"
            aria-label="刷新经营数据"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? "spinning" : ""} />
            {layout === "desktop" && "刷新"}
          </button>
        </div>

        <div className="yc-kpi-grid" aria-label="经营核心指标">
          <button
            className="yc-kpi-card sales"
            onClick={() => onScreenChange("sales")}
          >
            <span className="yc-kpi-icon">
              <ShoppingCart aria-hidden="true" />
            </span>
            <div>
              <small>{flowLabel}销售净额</small>
              <strong>{money(data.sales.net)}</strong>
              <p className={trendInfo?.direction ?? "flat"}>
                {trendInfo?.direction === "up" ? (
                  <TrendingUp aria-hidden="true" />
                ) : trendInfo?.direction === "down" ? (
                  <TrendingDown aria-hidden="true" />
                ) : null}
                {trendInfo?.label ?? "暂无昨日对比"}
                <em>退货 {money(data.sales.returns)}</em>
              </p>
            </div>
          </button>
          <button
            className="yc-kpi-card receivable"
            onClick={() => onScreenChange("debts")}
          >
            <span className="yc-kpi-icon">
              <CircleDollarSign aria-hidden="true" />
            </span>
            <div>
              <small>客户欠款</small>
              <strong>{money(data.receivables.outstanding)}</strong>
              <p>
                {data.receivables.overdueCount > 0
                  ? `${data.receivables.overdueCount} 笔已逾期`
                  : "暂无逾期"}
              </p>
            </div>
          </button>
          <button
            className="yc-kpi-card payable"
            onClick={() => onScreenChange("payables")}
          >
            <span className="yc-kpi-icon">
              <Truck aria-hidden="true" />
            </span>
            <div>
              <small>我们欠供应商</small>
              <strong>{money(data.payables.outstanding)}</strong>
              <p>{data.payables.count} 笔未结</p>
            </div>
          </button>
          <button
            className="yc-kpi-card cash"
            onClick={() => onScreenChange("payables")}
          >
            <span className="yc-kpi-icon">
              <Banknote aria-hidden="true" />
            </span>
            <div>
              <small>资金余额</small>
              <strong>{money(data.cash.balance)}</strong>
              <p>{data.cash.accountCount} 个启用账户</p>
            </div>
          </button>
        </div>
      </section>

      <p className="dashboard-generated">
        数据生成于{" "}
        {new Date(data.generatedAt).toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · 金额来自正式账本
      </p>
    </div>
  );
}
