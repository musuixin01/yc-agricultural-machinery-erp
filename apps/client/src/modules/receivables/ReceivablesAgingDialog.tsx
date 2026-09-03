import { useState, useMemo } from "react";
import {
  Clock3,
  X,
  Search,
  Filter,
  Send,
  Settings2,
  RotateCcw,
  Calendar,
  Layers,
} from "lucide-react";
import type { ReceivableEntry } from "./receivables-api";
import {
  analyzeReceivablesAging,
  DEFAULT_AGING_CONFIG_DAYS,
  DEFAULT_AGING_CONFIG_MONTHS,
  type AgingIntervalConfig,
  type AgingIntervalMode,
  type CustomerAgingSummary,
  type GlobalAgingOverview,
} from "./receivables-aging";
import { CustomerDunningNoticeDialog } from "./CustomerDunningNoticeDialog";

export function ReceivablesAgingDialog({
  entries,
  open,
  onClose,
  onOpenReceipt,
  onOpenStatement,
}: {
  entries: ReceivableEntry[];
  open: boolean;
  onClose: () => void;
  onOpenReceipt?: (customerId: string) => void;
  onOpenStatement?: (customerId: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [dunningCustomer, setDunningCustomer] =
    useState<CustomerAgingSummary | null>(null);

  // 自定义账龄区间配置
  const [showConfig, setShowConfig] = useState(false);
  const [agingConfig, setAgingConfig] = useState<AgingIntervalConfig>(() => {
    try {
      const saved = localStorage.getItem("RECEIVABLES_AGING_CONFIG_V2");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_AGING_CONFIG_DAYS;
  });

  const [editMode, setEditMode] = useState<AgingIntervalMode>(
    agingConfig.mode || "DAYS",
  );
  const [editTier1, setEditTier1] = useState(agingConfig.tier1);
  const [editTier2, setEditTier2] = useState(agingConfig.tier2);
  const [editTier3, setEditTier3] = useState(agingConfig.tier3);

  // 切换模式（天 / 月）时给出合理的初始默认值
  const handleSwitchMode = (newMode: AgingIntervalMode) => {
    setEditMode(newMode);
    if (newMode === "MONTHS") {
      setEditTier1(1);
      setEditTier2(3);
      setEditTier3(6);
    } else {
      setEditTier1(30);
      setEditTier2(60);
      setEditTier3(90);
    }
  };

  const handleSaveConfig = () => {
    let t1 = Math.max(1, Number(editTier1) || (editMode === "MONTHS" ? 1 : 30));
    let t2 = Math.max(
      t1 + 1,
      Number(editTier2) || (editMode === "MONTHS" ? 3 : 60),
    );
    let t3 = Math.max(
      t2 + 1,
      Number(editTier3) || (editMode === "MONTHS" ? 6 : 90),
    );

    const newConfig: AgingIntervalConfig = {
      mode: editMode,
      tier1: t1,
      tier2: t2,
      tier3: t3,
    };
    setAgingConfig(newConfig);
    setEditTier1(t1);
    setEditTier2(t2);
    setEditTier3(t3);
    localStorage.setItem(
      "RECEIVABLES_AGING_CONFIG_V2",
      JSON.stringify(newConfig),
    );
    setShowConfig(false);
  };

  const handleResetConfig = (mode: AgingIntervalMode = "DAYS") => {
    const target =
      mode === "MONTHS"
        ? DEFAULT_AGING_CONFIG_MONTHS
        : DEFAULT_AGING_CONFIG_DAYS;
    setAgingConfig(target);
    setEditMode(target.mode);
    setEditTier1(target.tier1);
    setEditTier2(target.tier2);
    setEditTier3(target.tier3);
    localStorage.setItem("RECEIVABLES_AGING_CONFIG_V2", JSON.stringify(target));
  };

  const overview: GlobalAgingOverview = useMemo(() => {
    return analyzeReceivablesAging(
      entries,
      new Date().toISOString().slice(0, 10),
      agingConfig,
    );
  }, [entries, agingConfig]);

  const filteredCustomers = useMemo(() => {
    return overview.customerSummaries.filter((c) => {
      const matchSearch =
        !searchTerm ||
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.customerPhone && c.customerPhone.includes(searchTerm));

      const matchRisk =
        riskFilter === "ALL" ||
        (riskFilter === "OVERDUE" && c.overdueAmount > 0) ||
        c.riskLevel === riskFilter;

      return matchSearch && matchRisk;
    });
  }, [overview.customerSummaries, searchTerm, riskFilter]);

  if (!open) return null;

  return (
    <div
      className="catalog-dialog-backdrop aging-dialog-backdrop"
      role="presentation"
    >
      <div
        className="catalog-dialog aging-dialog-wrapper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aging-dialog-title"
      >
        <header className="aging-dialog-header">
          <div className="aging-header-title">
            <Clock3 className="text-amber-600" size={22} />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="aging-dialog-title" className="aging-dialog-heading">
                  应收账款账龄分析与催款风控中心
                </h2>
                <span className="aging-mode-indicator">
                  {agingConfig.mode === "MONTHS" ? "按月统计" : "按日统计"}
                </span>
              </div>
              <p className="aging-dialog-subheading">
                当前区间分布：{overview.tierLabels.t1} ·{" "}
                {overview.tierLabels.t2} · {overview.tierLabels.t3} ·{" "}
                {overview.tierLabels.t4}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`outline-button inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md transition-all ${
                showConfig
                  ? "bg-amber-100 text-amber-900 border-amber-400 font-semibold"
                  : "hover:bg-slate-100"
              }`}
              onClick={() => {
                setEditMode(agingConfig.mode);
                setEditTier1(agingConfig.tier1);
                setEditTier2(agingConfig.tier2);
                setEditTier3(agingConfig.tier3);
                setShowConfig(!showConfig);
              }}
              title="自定义按天或按月统计账龄区间"
            >
              <Settings2 size={14} className="text-amber-700" />
              自定义账龄区间 (按天/按月)
            </button>
            <button
              type="button"
              className="outline-button print-close-btn"
              onClick={onClose}
              aria-label="关闭账龄分析"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="aging-dialog-body">
          {/* Custom Interval Settings Panel */}
          {showConfig && (
            <div className="aging-config-card">
              <div className="aging-config-header">
                <div className="flex items-center gap-2">
                  <Settings2 size={16} className="text-amber-600" />
                  <span className="font-bold text-slate-800 text-sm">
                    自定义账龄区间规则设置
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 hover:underline"
                    onClick={() => handleResetConfig(editMode)}
                  >
                    <RotateCcw size={12} /> 恢复当前默认
                  </button>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="aging-mode-tabs">
                <span className="text-xs font-semibold text-slate-700 mr-2 flex items-center gap-1">
                  <Layers size={13} /> 统计维度：
                </span>
                <button
                  type="button"
                  className={`mode-tab-btn ${editMode === "MONTHS" ? "active" : ""}`}
                  onClick={() => handleSwitchMode("MONTHS")}
                >
                  <Calendar size={13} /> 按月份划分 (如 0-1月 / 1-3月 / 3-6月 /
                  6月以上)
                </button>
                <button
                  type="button"
                  className={`mode-tab-btn ${editMode === "DAYS" ? "active" : ""}`}
                  onClick={() => handleSwitchMode("DAYS")}
                >
                  <Clock3 size={13} /> 按天数划分 (如 0-30天 / 31-60天 / 61-90天
                  / 90天以上)
                </button>
              </div>

              {/* Input Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
                <div className="aging-input-block">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    第 1 阶梯截止值 (0 ~ N {editMode === "MONTHS" ? "月" : "天"}
                    )
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={editMode === "MONTHS" ? 24 : 365}
                      value={editTier1}
                      onChange={(e) => setEditTier1(Number(e.target.value))}
                      className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:border-amber-500 focus:outline-none bg-white font-mono font-bold text-slate-800"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {editMode === "MONTHS" ? "个月" : "天"}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 block mt-1">
                    正常还款期：0 ~ {editTier1}{" "}
                    {editMode === "MONTHS" ? "个月" : "天"}
                  </span>
                </div>

                <div className="aging-input-block">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    第 2 阶梯截止值 ({editTier1} ~ N{" "}
                    {editMode === "MONTHS" ? "月" : "天"})
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={editTier1 + 1}
                      max={editMode === "MONTHS" ? 60 : 720}
                      value={editTier2}
                      onChange={(e) => setEditTier2(Number(e.target.value))}
                      className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:border-amber-500 focus:outline-none bg-white font-mono font-bold text-slate-800"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {editMode === "MONTHS" ? "个月" : "天"}
                    </span>
                  </div>
                  <span className="text-[11px] text-blue-700 block mt-1">
                    关注期：{editTier1} ~ {editTier2}{" "}
                    {editMode === "MONTHS" ? "个月" : "天"}
                  </span>
                </div>

                <div className="aging-input-block">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    第 3 阶梯截止值 ({editTier2} ~ N{" "}
                    {editMode === "MONTHS" ? "月" : "天"})
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={editTier2 + 1}
                      max={editMode === "MONTHS" ? 120 : 1800}
                      value={editTier3}
                      onChange={(e) => setEditTier3(Number(e.target.value))}
                      className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:border-amber-500 focus:outline-none bg-white font-mono font-bold text-slate-800"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {editMode === "MONTHS" ? "个月" : "天"}
                    </span>
                  </div>
                  <span className="text-[11px] text-red-600 block mt-1 font-semibold">
                    超期高危：超过 {editTier3}{" "}
                    {editMode === "MONTHS" ? "个月" : "天"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                <span className="text-xs text-slate-600">
                  生成规则预览：
                  <b className="text-slate-800">
                    {editMode === "MONTHS"
                      ? `0-${editTier1}月 / ${editTier1}-${editTier2}月 / ${editTier2}-${editTier3}月 / ${editTier3}月以上`
                      : `0-${editTier1}天 / ${editTier1 + 1}-${editTier2}天 / ${editTier2 + 1}-${editTier3}天 / ${editTier3}天以上`}
                  </b>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="outline-button text-xs py-1.5 px-3 bg-white"
                    onClick={() => setShowConfig(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="primary-button text-xs py-1.5 px-4 bg-amber-600 hover:bg-amber-700"
                    onClick={handleSaveConfig}
                  >
                    保存并应用区间
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Top KPI Metrics Cards */}
          <div className="aging-kpi-grid">
            <div className="aging-kpi-card">
              <span className="kpi-label">未收欠款总额</span>
              <span className="kpi-value text-slate-900">
                ¥
                {overview.totalOutstanding.toLocaleString("zh-CN", {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="kpi-sub">
                共 {overview.totalCustomers} 家客户挂账
              </span>
            </div>
            <div className="aging-kpi-card border-red-200 bg-red-50/40">
              <span className="kpi-label text-red-700">逾期欠款总额</span>
              <span className="kpi-value text-red-600">
                ¥
                {overview.totalOverdue.toLocaleString("zh-CN", {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="kpi-sub text-red-600">
                逾期占比{" "}
                {overview.totalOutstanding > 0
                  ? (
                      (overview.totalOverdue / overview.totalOutstanding) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="aging-kpi-card border-amber-200 bg-amber-50/40">
              <span className="kpi-label text-amber-700">重点催款客户</span>
              <span className="kpi-value text-amber-600">
                {overview.riskCustomersCount} 家
              </span>
              <span className="kpi-sub text-amber-700">
                逾期超 {overview.config.tier2}{" "}
                {overview.config.mode === "MONTHS" ? "个月" : "天"}以上高风险
              </span>
            </div>
          </div>

          {/* Aging Buckets Distribution Bar */}
          <div className="aging-buckets-panel">
            <h3 className="aging-section-heading">
              <span>全盘账龄梯级分布透视</span>
              <span className="text-xs text-slate-500 font-normal">
                区间刻度：{overview.tierLabels.t1} / {overview.tierLabels.t2} /{" "}
                {overview.tierLabels.t3} / {overview.tierLabels.t4}
              </span>
            </h3>

            <div className="aging-progress-bar-group">
              <div
                className="progress-seg bg-emerald-500"
                style={{
                  width: `${Math.max(2, overview.bucketPercentages.bucket1)}%`,
                }}
                title={`${overview.tierLabels.t1}: ¥${overview.bucketTotals.bucket1.toFixed(2)} (${overview.bucketPercentages.bucket1}%)`}
              />
              <div
                className="progress-seg bg-blue-500"
                style={{
                  width: `${Math.max(2, overview.bucketPercentages.bucket2)}%`,
                }}
                title={`${overview.tierLabels.t2}: ¥${overview.bucketTotals.bucket2.toFixed(2)} (${overview.bucketPercentages.bucket2}%)`}
              />
              <div
                className="progress-seg bg-amber-500"
                style={{
                  width: `${Math.max(2, overview.bucketPercentages.bucket3)}%`,
                }}
                title={`${overview.tierLabels.t3}: ¥${overview.bucketTotals.bucket3.toFixed(2)} (${overview.bucketPercentages.bucket3}%)`}
              />
              <div
                className="progress-seg bg-red-500"
                style={{
                  width: `${Math.max(2, overview.bucketPercentages.bucket4)}%`,
                }}
                title={`${overview.tierLabels.t4}: ¥${overview.bucketTotals.bucket4.toFixed(2)} (${overview.bucketPercentages.bucket4}%)`}
              />
            </div>

            <div className="aging-bucket-legend-grid">
              <div className="legend-box l-emerald">
                <div className="legend-dot bg-emerald-500" />
                <div>
                  <div className="legend-title">
                    {overview.tierLabels.t1} (正常/轻度)
                  </div>
                  <div className="legend-amount">
                    ¥{overview.bucketTotals.bucket1.toFixed(2)}
                  </div>
                  <div className="legend-pct">
                    {overview.bucketPercentages.bucket1}%
                  </div>
                </div>
              </div>
              <div className="legend-box l-blue">
                <div className="legend-dot bg-blue-500" />
                <div>
                  <div className="legend-title">
                    {overview.tierLabels.t2} (轻度关注)
                  </div>
                  <div className="legend-amount">
                    ¥{overview.bucketTotals.bucket2.toFixed(2)}
                  </div>
                  <div className="legend-pct">
                    {overview.bucketPercentages.bucket2}%
                  </div>
                </div>
              </div>
              <div className="legend-box l-amber">
                <div className="legend-dot bg-amber-500" />
                <div>
                  <div className="legend-title">
                    {overview.tierLabels.t3} (中度预警)
                  </div>
                  <div className="legend-amount">
                    ¥{overview.bucketTotals.bucket3.toFixed(2)}
                  </div>
                  <div className="legend-pct">
                    {overview.bucketPercentages.bucket3}%
                  </div>
                </div>
              </div>
              <div className="legend-box l-red">
                <div className="legend-dot bg-red-500" />
                <div>
                  <div className="legend-title">
                    {overview.tierLabels.t4} (重度/高危)
                  </div>
                  <div className="legend-amount">
                    ¥{overview.bucketTotals.bucket4.toFixed(2)}
                  </div>
                  <div className="legend-pct">
                    {overview.bucketPercentages.bucket4}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Table Toolbar */}
          <div className="aging-table-toolbar">
            <div className="aging-search-box">
              <Search size={15} className="text-slate-400" />
              <input
                type="text"
                placeholder="搜索客户名称、编码或联系电话..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="aging-filters">
              <Filter size={14} className="text-slate-400" />
              <button
                type="button"
                className={`filter-chip ${riskFilter === "ALL" ? "active" : ""}`}
                onClick={() => setRiskFilter("ALL")}
              >
                全部客户 ({overview.customerSummaries.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${riskFilter === "OVERDUE" ? "active" : ""}`}
                onClick={() => setRiskFilter("OVERDUE")}
              >
                仅看逾期客户 (
                {
                  overview.customerSummaries.filter((c) => c.overdueAmount > 0)
                    .length
                }
                )
              </button>
              <button
                type="button"
                className={`filter-chip chip-red ${riskFilter === "CRITICAL" ? "active" : ""}`}
                onClick={() => setRiskFilter("CRITICAL")}
              >
                高危呆账({overview.tierLabels.t4}) (
                {
                  overview.customerSummaries.filter(
                    (c) => c.riskLevel === "CRITICAL",
                  ).length
                }
                )
              </button>
            </div>
          </div>

          {/* Customer Breakdown Table */}
          <div className="aging-table-wrapper">
            <table className="aging-table">
              <thead>
                <tr>
                  <th>客户名称</th>
                  <th style={{ textAlign: "right" }}>未收总额</th>
                  <th style={{ textAlign: "right" }}>
                    {overview.tierLabels.t1}
                  </th>
                  <th style={{ textAlign: "right" }}>
                    {overview.tierLabels.t2}
                  </th>
                  <th style={{ textAlign: "right" }}>
                    {overview.tierLabels.t3}
                  </th>
                  <th style={{ textAlign: "right" }}>
                    {overview.tierLabels.t4}
                  </th>
                  <th style={{ textAlign: "center" }}>最长逾期</th>
                  <th style={{ textAlign: "center" }}>风控等级</th>
                  <th style={{ textAlign: "center", width: 220 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="aging-empty-row">
                      未查询到匹配的账龄记录
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => (
                    <tr key={cust.customerId}>
                      <td>
                        <div className="font-semibold text-slate-800">
                          {cust.customerName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {cust.customerCode}{" "}
                          {cust.customerPhone ? `· ${cust.customerPhone}` : ""}
                        </div>
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        ¥{cust.totalOutstanding.toFixed(2)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          color: cust.bucket1Amount > 0 ? "#10b981" : "#94a3b8",
                        }}
                      >
                        {cust.bucket1Amount > 0
                          ? `¥${cust.bucket1Amount.toFixed(2)}`
                          : "-"}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          color: cust.bucket2Amount > 0 ? "#3b82f6" : "#94a3b8",
                        }}
                      >
                        {cust.bucket2Amount > 0
                          ? `¥${cust.bucket2Amount.toFixed(2)}`
                          : "-"}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          color: cust.bucket3Amount > 0 ? "#f59e0b" : "#94a3b8",
                        }}
                      >
                        {cust.bucket3Amount > 0
                          ? `¥${cust.bucket3Amount.toFixed(2)}`
                          : "-"}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: cust.bucket4Amount > 0 ? 700 : 400,
                          color: cust.bucket4Amount > 0 ? "#ef4444" : "#94a3b8",
                        }}
                      >
                        {cust.bucket4Amount > 0
                          ? `¥${cust.bucket4Amount.toFixed(2)}`
                          : "-"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {cust.maxOverdueDays > 0 ? (
                          <span className="overdue-days-pill">
                            {agingConfig.mode === "MONTHS" &&
                            cust.maxOverdueMonths >= 1
                              ? `${cust.maxOverdueMonths}个月`
                              : `${cust.maxOverdueDays}天`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">未逾期</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {cust.riskLevel === "CRITICAL" && (
                          <span className="risk-badge risk-critical">
                            {overview.tierLabels.t4} 高危
                          </span>
                        )}
                        {cust.riskLevel === "HIGH" && (
                          <span className="risk-badge risk-high">中危预警</span>
                        )}
                        {cust.riskLevel === "MEDIUM" && (
                          <span className="risk-badge risk-medium">
                            关注注意
                          </span>
                        )}
                        {cust.riskLevel === "LOW" && (
                          <span className="risk-badge risk-low">正常还款</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="aging-row-actions">
                          <button
                            type="button"
                            className="btn-dunning"
                            onClick={() => setDunningCustomer(cust)}
                            title="一键生成催款通知函"
                          >
                            <Send size={13} /> 催款函
                          </button>
                          {onOpenReceipt && (
                            <button
                              type="button"
                              className="btn-aging-sub"
                              onClick={() => {
                                onClose();
                                onOpenReceipt(cust.customerId);
                              }}
                              title="登记收款"
                            >
                              收款
                            </button>
                          )}
                          {onOpenStatement && (
                            <button
                              type="button"
                              className="btn-aging-sub"
                              onClick={() => {
                                onClose();
                                onOpenStatement(cust.customerId);
                              }}
                              title="查看对账单"
                            >
                              对账
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dunning Notice Modal */}
      {dunningCustomer && (
        <CustomerDunningNoticeDialog
          open={dunningCustomer !== null}
          summary={dunningCustomer}
          onClose={() => setDunningCustomer(null)}
        />
      )}
    </div>
  );
}
