import { useRef, useState } from "react";
import { Barcode, Pencil, Trash2, Tractor } from "lucide-react";
import type { Product } from "./catalog-api";

export function SwipeableProductItem({
  product: p,
  index: i,
  onEdit,
  onPrintBarcode,
  onDelete,
}: {
  product: Product;
  index: number;
  onEdit: (product: Product) => void;
  onPrintBarcode: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);
  const currentOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);

  const DELETE_WIDTH = 80;

  const handleTouchStart = (e: React.TouchEvent | React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) {
      return;
    }
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startXRef.current = clientX;
    startYRef.current = clientY;
    isHorizontalRef.current = null;
    isDraggingRef.current = true;
    currentOffsetRef.current = isOpen ? -DELETE_WIDTH : 0;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (isHorizontalRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          isHorizontalRef.current = true;
        } else {
          isHorizontalRef.current = false;
          isDraggingRef.current = false;
          setIsSwiping(false);
          return;
        }
      } else {
        return;
      }
    }

    if (isHorizontalRef.current) {
      const baseOffset = isOpen ? -DELETE_WIDTH : 0;
      let newOffset = baseOffset + deltaX;
      // Disallow dragging right past 0
      if (newOffset > 0) {
        newOffset = 0;
      }
      // Rubber-banding if dragging left past -DELETE_WIDTH
      if (newOffset < -DELETE_WIDTH) {
        const excess = -DELETE_WIDTH - newOffset;
        newOffset = -DELETE_WIDTH - excess * 0.2;
      }
      currentOffsetRef.current = newOffset;
      setOffsetX(newOffset);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current && isHorizontalRef.current === null) return;
    isDraggingRef.current = false;
    setIsSwiping(false);

    if (isHorizontalRef.current) {
      if (currentOffsetRef.current < -35) {
        setOffsetX(-DELETE_WIDTH);
        setIsOpen(true);
      } else {
        setOffsetX(0);
        setIsOpen(false);
      }
    }
    isHorizontalRef.current = null;
  };

  const closeSwipe = () => {
    setOffsetX(0);
    setIsOpen(false);
  };

  return (
    <div className="c-swipeable-wrapper">
      <button
        type="button"
        className="c-swipeable-delete-layer"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(p);
          closeSwipe();
        }}
        aria-label={`删除商品 ${p.name}`}
      >
        <Trash2 size={18} />
        <span>删除</span>
      </button>

      <article
        className={`c-swipeable-card ${p.status === "INACTIVE" ? "is-inactive" : ""} ${
          isSwiping ? "is-swiping" : ""
        } ${isOpen ? "is-open" : ""}`}
        style={{
          transform: `translateX(${offsetX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onPointerDown={handleTouchStart}
        onPointerMove={handleTouchMove}
        onPointerUp={handleTouchEnd}
        onPointerCancel={handleTouchEnd}
        onClick={() => {
          if (isOpen) {
            closeSwipe();
          }
        }}
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
        <div className="flex flex-col gap-1 items-center">
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 transition-colors"
            title={`打印 ${p.name} 条码标签`}
            onClick={(e) => {
              e.stopPropagation();
              onPrintBarcode(p);
            }}
          >
            <Barcode size={17} />
          </button>
          <button
            aria-label={`编辑 ${p.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(p);
            }}
          >
            <Pencil />
          </button>
        </div>
      </article>
    </div>
  );
}
