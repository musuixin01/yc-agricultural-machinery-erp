import { useState, useRef, useMemo } from "react";
import {
  Printer,
  X,
  Barcode,
  QrCode,
  Layers,
  Settings2,
  Plus,
  Minus,
  Trash2,
  Check,
  Building,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { Product } from "./catalog-api";
import { useBusinessProfile } from "../administration/use-administration";
import {
  buildBarcodePrintViewModel,
  generateCode128Bars,
  generateQRCodeMatrix,
  DEFAULT_LABEL_CONFIG,
  type BarcodeLabelConfig,
  type BarcodeLabelSize,
  type BarcodePrintItem,
  type BarcodeType,
} from "./product-barcode-print";

export function ProductBarcodePrintDialog({
  initialProducts = [],
  allProducts = [],
  open,
  onClose,
}: {
  initialProducts?: Product[];
  allProducts?: Product[];
  open: boolean;
  onClose: () => void;
}) {
  const profileQuery = useBusinessProfile();
  const printRef = useRef<HTMLDivElement>(null);

  // 待打印清单列表
  const [printItems, setPrintItems] = useState<BarcodePrintItem[]>(() => {
    return initialProducts.map((p) => ({
      product: p,
      printCopies: 1,
      customPrice: p.retailPrice,
      customBatchNo: "",
      customSpec: p.specification || "",
    }));
  });

  // 标签设计与排版配置
  const [config, setConfig] = useState<BarcodeLabelConfig>(() => {
    try {
      const saved = localStorage.getItem("YC_BARCODE_LABEL_CONFIG");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_LABEL_CONFIG;
  });

  // 搜索添加商品
  const [searchAdd, setSearchAdd] = useState("");
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  // 快捷批量改份数
  const handleBatchSetCopies = (count: number) => {
    setPrintItems((prev) =>
      prev.map((item) => ({ ...item, printCopies: count })),
    );
  };

  const handleUpdateItemCopies = (index: number, delta: number) => {
    setPrintItems((prev) => {
      const clone = [...prev];
      const next = Math.max(1, (clone[index].printCopies || 1) + delta);
      clone[index] = { ...clone[index], printCopies: next };
      return clone;
    });
  };

  const handleRemoveItem = (index: number) => {
    setPrintItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddProduct = (prod: Product) => {
    if (printItems.some((item) => item.product.id === prod.id)) {
      setPrintItems((prev) =>
        prev.map((item) =>
          item.product.id === prod.id
            ? { ...item, printCopies: item.printCopies + 1 }
            : item,
        ),
      );
    } else {
      setPrintItems((prev) => [
        ...prev,
        {
          product: prod,
          printCopies: 1,
          customPrice: prod.retailPrice,
          customBatchNo: "",
          customSpec: prod.specification || "",
        },
      ]);
    }
  };

  const handleSaveConfig = (newConfig: BarcodeLabelConfig) => {
    setConfig(newConfig);
    localStorage.setItem("YC_BARCODE_LABEL_CONFIG", JSON.stringify(newConfig));
  };

  const handlePrint = () => {
    window.print();
  };

  const viewModel = useMemo(() => {
    return buildBarcodePrintViewModel(
      printItems,
      config,
      profileQuery.data ?? null,
    );
  }, [printItems, config, profileQuery.data]);

  const candidateProducts = useMemo(() => {
    if (!searchAdd.trim()) return [];
    const term = searchAdd.toLowerCase();
    return allProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term) ||
          p.barcodes?.some((b) => b.barcode.includes(term)),
      )
      .slice(0, 6);
  }, [allProducts, searchAdd]);

  if (!open) return null;

  return (
    <div
      className="catalog-dialog-backdrop barcode-dialog-backdrop"
      role="presentation"
    >
      <div
        className="catalog-dialog barcode-dialog-wrapper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-dialog-title"
      >
        <header className="barcode-dialog-header no-print">
          <div className="barcode-header-left">
            <Barcode className="text-emerald-600" size={22} />
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="barcode-dialog-title"
                  className="barcode-dialog-heading"
                >
                  商品条码标签设计与批量打印中心
                </h2>
                <span className="barcode-spec-pill">
                  {config.size === "40x30" && "40×30 mm 单排热敏"}
                  {config.size === "60x40" && "60×40 mm 标准货架"}
                  {config.size === "80x50" && "80×50 mm 仓储物料"}
                  {config.size === "A4_GRID" && "A4 纸 24联标签"}
                </span>
                <span className="barcode-type-pill">
                  {config.barcodeType === "CODE128"
                    ? "Code128 一维码"
                    : "QR Code 二维码"}
                </span>
              </div>
              <p className="barcode-dialog-subheading">
                已选 {printItems.length} 个商品 · 累计生成{" "}
                {viewModel.totalCopies} 张标签
              </p>
            </div>
          </div>

          <div className="barcode-header-controls">
            <button
              type="button"
              className={`outline-button inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md transition-all ${
                showConfigDrawer
                  ? "bg-emerald-100 text-emerald-900 border-emerald-400 font-semibold"
                  : "hover:bg-slate-100"
              }`}
              onClick={() => setShowConfigDrawer(!showConfigDrawer)}
              title="标签规格、显示字段及排版属性"
            >
              <Settings2 size={14} className="text-emerald-700" />
              标签排版设计
            </button>

            <button
              type="button"
              className="primary-button inline-flex items-center gap-1.5 text-xs py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 font-semibold"
              onClick={handlePrint}
              disabled={viewModel.totalCopies === 0}
            >
              <Printer size={15} /> 立即打印 ({viewModel.totalCopies}张)
            </button>

            <button
              type="button"
              className="outline-button print-close-btn"
              onClick={onClose}
              aria-label="关闭条码打印窗口"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="barcode-dialog-content">
          {/* Left Column: Product Selection & Copies Grid */}
          <div className="barcode-sidebar-panel no-print">
            <div className="sidebar-section-title">
              <span>待打印商品清单 ({printItems.length})</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="quick-copies-btn"
                  onClick={() => handleBatchSetCopies(1)}
                  title="全部设为 1 张"
                >
                  全1张
                </button>
                <button
                  type="button"
                  className="quick-copies-btn"
                  onClick={() => handleBatchSetCopies(5)}
                  title="全部设为 5 张"
                >
                  全5张
                </button>
                <button
                  type="button"
                  className="quick-copies-btn"
                  onClick={() => handleBatchSetCopies(10)}
                  title="全部设为 10 张"
                >
                  全10张
                </button>
              </div>
            </div>

            {/* Quick Add Product Search */}
            <div className="barcode-search-box">
              <input
                type="text"
                placeholder="输入品名/编码/条码快速添加..."
                value={searchAdd}
                onChange={(e) => setSearchAdd(e.target.value)}
              />
              {candidateProducts.length > 0 && (
                <div className="search-dropdown-menu">
                  {candidateProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="search-dropdown-item"
                      onClick={() => {
                        handleAddProduct(p);
                        setSearchAdd("");
                      }}
                    >
                      <div className="font-semibold text-slate-800">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {p.code} · ¥{p.retailPrice}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="barcode-items-scroll">
              {printItems.length === 0 ? (
                <div className="empty-barcode-tip">
                  暂无待打印商品，请在商品列表选择或上方搜索添加
                </div>
              ) : (
                printItems.map((item, idx) => (
                  <div key={item.product.id} className="barcode-item-card">
                    <div className="item-card-top">
                      <div className="item-name" title={item.product.name}>
                        {item.product.name}
                      </div>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-600 p-1"
                        onClick={() => handleRemoveItem(idx)}
                        title="移除商品"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="item-card-sub">
                      <span className="font-mono text-xs text-slate-500">
                        {item.product.code}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">
                        ¥
                        {Number(
                          item.customPrice || item.product.retailPrice,
                        ).toFixed(2)}
                      </span>
                    </div>

                    <div className="item-card-controls">
                      <span className="text-[11px] text-slate-500">
                        打印份数:
                      </span>
                      <div className="copies-stepper">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemCopies(idx, -1)}
                          disabled={item.printCopies <= 1}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={item.printCopies}
                          onChange={(e) => {
                            const val = Math.max(
                              1,
                              Number(e.target.value) || 1,
                            );
                            setPrintItems((prev) => {
                              const c = [...prev];
                              c[idx] = { ...c[idx], printCopies: val };
                              return c;
                            });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateItemCopies(idx, 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Main Preview Area */}
          <div className="barcode-preview-workspace" ref={printRef}>
            {/* Design Config Drawer */}
            {showConfigDrawer && (
              <div className="barcode-config-drawer no-print">
                <div className="drawer-header">
                  <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Settings2 size={15} className="text-emerald-600" />
                    标签尺寸与视觉字段配置
                  </span>
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                    onClick={() => handleSaveConfig(DEFAULT_LABEL_CONFIG)}
                  >
                    <RotateCcw size={12} /> 恢复默认
                  </button>
                </div>

                <div className="drawer-body-grid">
                  {/* Size Preset */}
                  <div className="config-block">
                    <label className="config-title">标签物理尺寸规格：</label>
                    <div className="size-buttons-group">
                      <button
                        type="button"
                        className={`size-tab ${config.size === "40x30" ? "active" : ""}`}
                        onClick={() =>
                          handleSaveConfig({ ...config, size: "40x30" })
                        }
                      >
                        40 × 30 mm (小件/货位)
                      </button>
                      <button
                        type="button"
                        className={`size-tab ${config.size === "60x40" ? "active" : ""}`}
                        onClick={() =>
                          handleSaveConfig({ ...config, size: "60x40" })
                        }
                      >
                        60 × 40 mm (标准货架/商品)
                      </button>
                      <button
                        type="button"
                        className={`size-tab ${config.size === "80x50" ? "active" : ""}`}
                        onClick={() =>
                          handleSaveConfig({ ...config, size: "80x50" })
                        }
                      >
                        80 × 50 mm (仓储箱标/大标)
                      </button>
                      <button
                        type="button"
                        className={`size-tab ${config.size === "A4_GRID" ? "active" : ""}`}
                        onClick={() =>
                          handleSaveConfig({ ...config, size: "A4_GRID" })
                        }
                      >
                        A4 激光不干胶 (24联 3×8)
                      </button>
                    </div>
                  </div>

                  {/* Code Type */}
                  <div className="config-block">
                    <label className="config-title">码制格式选择：</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`code-tab ${config.barcodeType === "CODE128" ? "active" : ""}`}
                        onClick={() =>
                          handleSaveConfig({
                            ...config,
                            barcodeType: "CODE128",
                          })
                        }
                      >
                        <Barcode size={15} /> Code128 一维条码
                      </button>
                      <button
                        type="button"
                        className={`code-tab ${config.barcodeType === "QRCODE" ? "active" : ""}`}
                        onClick={() =>
                          handleSaveConfig({ ...config, barcodeType: "QRCODE" })
                        }
                      >
                        <QrCode size={15} /> QR Code 二维码
                      </button>
                    </div>
                  </div>

                  {/* Visible Fields Toggle Switches */}
                  <div className="config-block">
                    <label className="config-title">标签版面字段开关：</label>
                    <div className="fields-checkbox-grid">
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={config.showStoreName}
                          onChange={(e) =>
                            handleSaveConfig({
                              ...config,
                              showStoreName: e.target.checked,
                            })
                          }
                        />
                        <span>门店/企业名称</span>
                      </label>
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={config.showProductName}
                          onChange={(e) =>
                            handleSaveConfig({
                              ...config,
                              showProductName: e.target.checked,
                            })
                          }
                        />
                        <span>商品名称</span>
                      </label>
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={config.showProductCode}
                          onChange={(e) =>
                            handleSaveConfig({
                              ...config,
                              showProductCode: e.target.checked,
                            })
                          }
                        />
                        <span>商品编码</span>
                      </label>
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={config.showSpecification}
                          onChange={(e) =>
                            handleSaveConfig({
                              ...config,
                              showSpecification: e.target.checked,
                            })
                          }
                        />
                        <span>规格/型号</span>
                      </label>
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={config.showRetailPrice}
                          onChange={(e) =>
                            handleSaveConfig({
                              ...config,
                              showRetailPrice: e.target.checked,
                            })
                          }
                        />
                        <span>零售指导价</span>
                      </label>
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={config.showUnit}
                          onChange={(e) =>
                            handleSaveConfig({
                              ...config,
                              showUnit: e.target.checked,
                            })
                          }
                        />
                        <span>计量单位</span>
                      </label>
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={config.showBatchNo}
                          onChange={(e) =>
                            handleSaveConfig({
                              ...config,
                              showBatchNo: e.target.checked,
                            })
                          }
                        />
                        <span>批次号 (Batch)</span>
                      </label>
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={config.showBarcodeText}
                          onChange={(e) =>
                            handleSaveConfig({
                              ...config,
                              showBarcodeText: e.target.checked,
                            })
                          }
                        />
                        <span>条码数字明文</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Labels Real-time Flow Grid */}
            <div
              className={`barcode-print-canvas size-${config.size.toLowerCase()}`}
            >
              {viewModel.labels.length === 0 ? (
                <div className="no-labels-notice no-print">
                  <Barcode size={36} className="text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-600">
                    当前未选择任何打印标签
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    在左侧列表中添加商品或调整份数后即可实时预览并打印
                  </p>
                </div>
              ) : (
                <div
                  className={`labels-container-grid layout-${config.size.toLowerCase()}`}
                >
                  {viewModel.labels.map((lbl, idx) => (
                    <SingleBarcodeCard
                      key={`${lbl.productId}-${idx}`}
                      label={lbl}
                      config={config}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 单张标签渲染组件 (根据规格自适应尺寸)
 */
function SingleBarcodeCard({
  label,
  config,
}: {
  label: BarcodePrintViewModel["labels"][0];
  config: BarcodeLabelConfig;
}) {
  const code128Bits = useMemo(() => {
    return generateCode128Bars(label.barcode);
  }, [label.barcode]);

  const qrMatrix = useMemo(() => {
    return generateQRCodeMatrix(label.barcode, 21);
  }, [label.barcode]);

  return (
    <div className={`barcode-label-item label-sz-${config.size.toLowerCase()}`}>
      {/* 1. Header (Store / Enterprise Name) */}
      {config.showStoreName && (
        <div className="label-store-header">
          <span className="store-name">{label.storeName}</span>
          <span className="tag-origin">{label.origin}</span>
        </div>
      )}

      {/* 2. Product Name & Spec */}
      <div className="label-product-header">
        {config.showProductName && (
          <div className="label-pname" title={label.productName}>
            {label.productName}
          </div>
        )}
        <div className="label-meta-row">
          {config.showProductCode && (
            <span className="label-pcode">编码: {label.productCode}</span>
          )}
          {config.showSpecification && (label.specification || label.model) && (
            <span className="label-pspec">
              规格:{" "}
              {[label.model, label.specification].filter(Boolean).join(" ")}
            </span>
          )}
        </div>
      </div>

      {/* 3. Barcode / QR Code Graphic Area */}
      <div className="label-code-graphic-container">
        {config.barcodeType === "CODE128" ? (
          <div className="barcode-svg-wrapper">
            <svg
              viewBox={`0 0 ${code128Bits.length} 38`}
              preserveAspectRatio="none"
              className="barcode-svg"
            >
              {code128Bits.map((isBlack, i) =>
                isBlack ? (
                  <rect
                    key={i}
                    x={i}
                    y={0}
                    width={1}
                    height={38}
                    fill="#000000"
                  />
                ) : null,
              )}
            </svg>
            {config.showBarcodeText && (
              <div className="barcode-digits-text">{label.barcode}</div>
            )}
          </div>
        ) : (
          <div className="qrcode-graphic-row">
            <svg
              viewBox="0 0 21 21"
              shapeRendering="crispEdges"
              className="qrcode-svg"
            >
              {qrMatrix.map((row, r) =>
                row.map((val, c) =>
                  val ? (
                    <rect
                      key={`${r}-${c}`}
                      x={c}
                      y={r}
                      width={1}
                      height={1}
                      fill="#000000"
                    />
                  ) : null,
                ),
              )}
            </svg>
            <div className="qrcode-info-col">
              {config.showBarcodeText && (
                <div className="qrcode-code-num">{label.barcode}</div>
              )}
              {config.showBatchNo && (
                <div className="qrcode-batch-text">批次: {label.batchNo}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Price & Footer Meta */}
      <div className="label-footer-row">
        {config.showBatchNo && config.barcodeType === "CODE128" && (
          <span className="label-batch-pill">批号:{label.batchNo}</span>
        )}
        {config.showRetailPrice && (
          <div className="label-price-block">
            <span className="price-label">零售价:</span>
            <span className="price-num">
              ¥{label.retailPrice.toFixed(2)}
              {config.showUnit && <small>/{label.unitName}</small>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
