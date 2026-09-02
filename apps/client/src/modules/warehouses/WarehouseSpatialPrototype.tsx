import { useMemo, useState } from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Grip,
  Hash,
  Layers3,
  Map,
  Move,
  PackageSearch,
  PencilRuler,
  Plus,
  Ruler,
  Rotate3d,
  Search,
  Warehouse,
  X,
} from "lucide-react";

type MapVariant = "A" | "B" | "C";

type DemoItem = {
  name: string;
  code: string;
  barcode: string;
  quantity: string;
  path: string;
  zone: "A" | "B" | "M";
  shelf: number;
  level: number;
  bin: number;
};

type ShelfConfig = {
  id: string;
  zone: "A" | "B";
  number: number;
  levels: number;
  levelHeight: number;
  column: number;
  row: number;
};

const initialShelves: ShelfConfig[] = [
  ...[1, 2, 3, 4, 5].map((number, index) => ({
    id: `A-${number}`,
    zone: "A" as const,
    number,
    levels: 3,
    levelHeight: 55,
    column: (index % 2) + 1,
    row: Math.floor(index / 2) + 1,
  })),
  ...[1, 2, 3, 4].map((number, index) => ({
    id: `B-${number}`,
    zone: "B" as const,
    number,
    levels: 3,
    levelHeight: 45,
    column: (index % 2) + 1,
    row: Math.floor(index / 2) + 1,
  })),
];

const demoItems: DemoItem[] = [
  {
    name: "柴油滤芯 CX0708",
    code: "PJ-CX0708",
    barcode: "690000070801",
    quantity: "5 个",
    path: "主仓 / A区 / 03架 / 2层 / 04位",
    zone: "A",
    shelf: 3,
    level: 2,
    bin: 4,
  },
  {
    name: "高强度螺栓 M12×45",
    code: "LS-M1245",
    barcode: "690000124501",
    quantity: "86 个",
    path: "主仓 / B区 / 02架 / 3层 / 08位",
    zone: "B",
    shelf: 2,
    level: 3,
    bin: 8,
  },
  {
    name: "旋耕机刀片 245型",
    code: "DP-245",
    barcode: "690000024501",
    quantity: "24 片",
    path: "主仓 / A区 / 05架 / 1层 / 02位",
    zone: "A",
    shelf: 5,
    level: 1,
    bin: 2,
  },
  {
    name: "东方红 LX904",
    code: "ZJ-LX904",
    barcode: "690009040001",
    quantity: "1 台",
    path: "主仓 / 整机区 / M-01位",
    zone: "M",
    shelf: 1,
    level: 1,
    bin: 1,
  },
];

const variantMeta: Record<MapVariant, { name: string; note: string }> = {
  A: { name: "立体鸟瞰", note: "推荐 · 一眼看清整个仓库" },
  B: { name: "走入仓库", note: "沉浸 · 适合大屏巡库" },
  C: { name: "平面 + 货架", note: "精确 · 手机端最清楚" },
};

function Marker({ label }: { label?: string }) {
  return (
    <span className="spatial-marker" aria-label={label ?? "商品所在库位"}>
      <i />
      <b />
    </span>
  );
}

function Shelf({
  config,
  selected,
  editing,
  onEdit,
}: {
  config: ShelfConfig;
  selected: DemoItem | null;
  editing: boolean;
  onEdit: (id: string) => void;
}) {
  const active =
    selected?.zone === config.zone && selected.shelf === config.number;
  return (
    <button
      type="button"
      className={`spatial-shelf${active ? " is-target" : ""}${editing ? " is-editing" : ""}`}
      data-zone={config.zone}
      data-shelf={String(config.number).padStart(2, "0")}
      style={{
        gridColumn: config.column,
        gridRow: config.row,
        minHeight: Math.max(
          54,
          Math.min(122, (config.levels * config.levelHeight) / 2),
        ),
      }}
      onClick={() => onEdit(config.id)}
    >
      {Array.from(
        { length: config.levels },
        (_, index) => config.levels - index,
      ).map((level) => (
        <div className="spatial-shelf-level" key={level}>
          {[1, 2, 3, 4].map((bin) => {
            const markerHere =
              active &&
              selected?.level === level &&
              Math.ceil(selected.bin / 2) === bin;
            return (
              <span key={bin}>
                {markerHere ? <Marker label={selected.name} /> : null}
              </span>
            );
          })}
        </div>
      ))}
      <strong>
        {config.zone}-{String(config.number).padStart(2, "0")}
      </strong>
      {editing ? <Grip className="spatial-edit-grip" size={11} /> : null}
    </button>
  );
}

function IsometricView({
  selected,
  shelves,
  zoneNames,
  editingShelfId,
  onEditShelf,
}: {
  selected: DemoItem | null;
  shelves: ShelfConfig[];
  zoneNames: Record<"A" | "B", string>;
  editingShelfId: string | null;
  onEditShelf: (id: string) => void;
}) {
  return (
    <div className="spatial-scene spatial-isometric">
      <div className="spatial-scene-caption">
        <span>主仓实时示意</span>
        <small>入口 ↑</small>
      </div>
      <div className="spatial-floor">
        <div className="spatial-zone zone-a">
          <em>A {zoneNames.A}</em>
          {shelves
            .filter((shelf) => shelf.zone === "A")
            .map((shelf) => (
              <Shelf
                key={shelf.id}
                config={shelf}
                selected={selected}
                editing={editingShelfId === shelf.id}
                onEdit={onEditShelf}
              />
            ))}
        </div>
        <div className="spatial-aisle">主通道</div>
        <div className="spatial-zone zone-b">
          <em>B {zoneNames.B}</em>
          {shelves
            .filter((shelf) => shelf.zone === "B")
            .map((shelf) => (
              <Shelf
                key={shelf.id}
                config={shelf}
                selected={selected}
                editing={editingShelfId === shelf.id}
                onEdit={onEditShelf}
              />
            ))}
        </div>
        <div
          className={`spatial-machine-bay${selected?.zone === "M" ? " is-target" : ""}`}
        >
          <Box size={28} />
          <span>整机区 M-01</span>
          {selected?.zone === "M" ? <Marker label={selected.name} /> : null}
        </div>
      </div>
    </div>
  );
}

function WalkInView({ selected }: { selected: DemoItem | null }) {
  const targetSide = selected?.zone === "B" ? "right" : "left";
  return (
    <div className="spatial-scene spatial-walkin">
      <div className="walkin-ceiling" />
      <div className="walkin-aisle-line left" />
      <div className="walkin-aisle-line right" />
      <div className="walkin-end">
        <Warehouse size={32} />
        <span>主仓后场</span>
      </div>
      {[0, 1, 2, 3].map((index) => {
        const shelfNo = 4 - index;
        const leftTarget =
          targetSide === "left" &&
          selected?.zone === "A" &&
          selected.shelf === shelfNo;
        const rightTarget =
          targetSide === "right" &&
          selected?.zone === "B" &&
          selected.shelf === shelfNo;
        return (
          <div
            className="walkin-row"
            style={{ "--depth": index } as React.CSSProperties}
            key={index}
          >
            <div
              className={`walkin-rack left${leftTarget ? " is-target" : ""}`}
            >
              <span>A-{String(shelfNo).padStart(2, "0")}</span>
              {leftTarget ? <Marker label={selected.name} /> : null}
            </div>
            <div
              className={`walkin-rack right${rightTarget ? " is-target" : ""}`}
            >
              <span>B-{String(shelfNo).padStart(2, "0")}</span>
              {rightTarget ? <Marker label={selected.name} /> : null}
            </div>
          </div>
        );
      })}
      {selected?.zone === "M" ? (
        <div className="walkin-machine-target">
          <Marker label={selected.name} />
          整机区 M-01
        </div>
      ) : null}
      <div className="walkin-controls">
        <Rotate3d size={16} /> 左右拖动查看 · 双击回正
      </div>
    </div>
  );
}

function PlanAndShelfView({
  selected,
  shelves,
  zoneNames,
}: {
  selected: DemoItem | null;
  shelves: ShelfConfig[];
  zoneNames: Record<"A" | "B", string>;
}) {
  const zone = selected?.zone ?? "A";
  const selectedShelf = shelves.find(
    (shelf) =>
      shelf.zone === selected?.zone && shelf.number === selected?.shelf,
  );
  const levelCount = selectedShelf?.levels ?? 3;
  return (
    <div className="spatial-split-view">
      <section className="spatial-plan">
        <header>
          <Map size={17} />
          <b>仓库平面</b>
          <span>点击区域查看</span>
        </header>
        <div className="plan-grid">
          <div className={`plan-zone a${zone === "A" ? " is-active" : ""}`}>
            A {zoneNames.A}
          </div>
          <div className="plan-aisle">主通道</div>
          <div className={`plan-zone b${zone === "B" ? " is-active" : ""}`}>
            B {zoneNames.B}
          </div>
          <div className={`plan-zone m${zone === "M" ? " is-active" : ""}`}>
            整机区 M
          </div>
          {selected ? <Marker label={selected.name} /> : null}
        </div>
      </section>
      <section className="spatial-elevation">
        <header>
          <Layers3 size={17} />
          <b>
            {selected
              ? `${selected.zone}-${String(selected.shelf).padStart(2, "0")} 货架正面`
              : "选择货架"}
          </b>
          <span>层 / 位</span>
        </header>
        <div className="elevation-grid">
          {Array.from(
            { length: levelCount },
            (_, index) => levelCount - index,
          ).map((level) =>
            [1, 2, 3, 4, 5, 6, 7, 8].map((bin) => {
              const active = selected?.level === level && selected.bin === bin;
              return (
                <span
                  className={active ? "is-target" : ""}
                  key={`${level}-${bin}`}
                >
                  <small>
                    {level}-{String(bin).padStart(2, "0")}
                  </small>
                  {active ? <Marker label={selected.name} /> : null}
                </span>
              );
            }),
          )}
        </div>
      </section>
    </div>
  );
}

function LayoutEditor({
  shelf,
  zoneNames,
  onClose,
  onChange,
  onZoneNameChange,
}: {
  shelf: ShelfConfig;
  zoneNames: Record<"A" | "B", string>;
  onClose: () => void;
  onChange: (patch: Partial<ShelfConfig>) => void;
  onZoneNameChange: (zone: "A" | "B", name: string) => void;
}) {
  return (
    <aside className="spatial-layout-editor">
      <header>
        <div>
          <PencilRuler size={18} />
          <span>
            <b>编辑货架</b>
            <small>修改后立即显示 · 原型不保存</small>
          </span>
        </div>
        <button onClick={onClose} aria-label="关闭编辑器">
          <X size={17} />
        </button>
      </header>
      <div className="layout-editor-identity">
        <span>
          {shelf.zone}-{String(shelf.number).padStart(2, "0")}
        </span>
        <div>
          <b>{zoneNames[shelf.zone]}</b>
          <small>
            第 {shelf.row} 行 · 第 {shelf.column} 列
          </small>
        </div>
      </div>
      <div className="layout-editor-fields">
        <label>
          <span>所属区域</span>
          <select
            value={shelf.zone}
            onChange={(event) =>
              onChange({ zone: event.target.value as "A" | "B" })
            }
          >
            <option value="A">A 区</option>
            <option value="B">B 区</option>
          </select>
        </label>
        <label>
          <span>区域名称</span>
          <input
            value={zoneNames[shelf.zone]}
            maxLength={12}
            onChange={(event) =>
              onZoneNameChange(shelf.zone, event.target.value)
            }
          />
        </label>
        <label>
          <span>
            <Hash size={13} />
            货架号
          </span>
          <input
            type="number"
            min="1"
            max="99"
            value={shelf.number}
            onChange={(event) =>
              onChange({
                number: Math.max(1, Math.min(99, Number(event.target.value))),
              })
            }
          />
        </label>
        <label>
          <span>
            <Layers3 size={13} />
            货架层数
          </span>
          <select
            value={shelf.levels}
            onChange={(event) =>
              onChange({ levels: Number(event.target.value) })
            }
          >
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <option value={count} key={count}>
                {count} 层
              </option>
            ))}
          </select>
        </label>
        <label className="editor-wide">
          <span>
            <Ruler size={13} />
            每层净高
          </span>
          <div className="editor-unit-input">
            <input
              type="number"
              min="20"
              max="200"
              step="5"
              value={shelf.levelHeight}
              onChange={(event) =>
                onChange({
                  levelHeight: Math.max(
                    20,
                    Math.min(200, Number(event.target.value)),
                  ),
                })
              }
            />
            <em>厘米</em>
          </div>
        </label>
      </div>
      <section className="layout-position-control">
        <div>
          <Move size={15} />
          <span>
            <b>摆放位置</b>
            <small>选择仓库平面中的行列</small>
          </span>
        </div>
        <div className="position-grid">
          {[1, 2, 3].flatMap((row) =>
            [1, 2].map((column) => (
              <button
                className={
                  shelf.row === row && shelf.column === column ? "active" : ""
                }
                onClick={() => onChange({ row, column })}
                key={`${row}-${column}`}
              >
                <span>
                  {row}-{column}
                </span>
              </button>
            )),
          )}
        </div>
      </section>
      <footer>
        <span>当前结构</span>
        <b>
          {shelf.levels} 层 × 每层 {shelf.levelHeight}cm
        </b>
        <small>总有效高度约 {shelf.levels * shelf.levelHeight}cm</small>
      </footer>
    </aside>
  );
}

export function WarehouseSpatialPrototype() {
  const initialVariant = new URLSearchParams(window.location.search).get("map");
  const [variant, setVariant] = useState<MapVariant>(
    initialVariant === "B" || initialVariant === "C" ? initialVariant : "A",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DemoItem | null>(null);
  const [items, setItems] = useState(demoItems);
  const [shelves, setShelves] = useState(initialShelves);
  const [zoneNames, setZoneNames] = useState<Record<"A" | "B", string>>({
    A: "配件区",
    B: "紧固件区",
  });
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const editingShelf =
    shelves.find((shelf) => shelf.id === editingShelfId) ?? null;

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.name} ${item.code} ${item.barcode}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query]);

  const updateShelf = (patch: Partial<ShelfConfig>) => {
    if (!editingShelf) return;
    const previous = editingShelf;
    let next = { ...previous, ...patch };
    if (patch.zone && patch.zone !== previous.zone) {
      const targetShelves = shelves.filter(
        (shelf) => shelf.zone === patch.zone,
      );
      if (targetShelves.some((shelf) => shelf.number === next.number)) {
        next = {
          ...next,
          number:
            Math.max(0, ...targetShelves.map((shelf) => shelf.number)) + 1,
        };
      }
      const openPosition = [1, 2, 3]
        .flatMap((row) => [1, 2].map((column) => ({ row, column })))
        .find(
          (position) =>
            !targetShelves.some(
              (shelf) =>
                shelf.row === position.row && shelf.column === position.column,
            ),
        );
      if (openPosition) next = { ...next, ...openPosition };
    }
    setShelves((current) =>
      current.map((shelf) => {
        if (shelf.id === previous.id) return next;
        const movingWithinZone = !patch.zone || patch.zone === previous.zone;
        if (
          movingWithinZone &&
          (patch.row || patch.column) &&
          shelf.zone === next.zone &&
          shelf.row === next.row &&
          shelf.column === next.column
        ) {
          return { ...shelf, row: previous.row, column: previous.column };
        }
        return shelf;
      }),
    );
    if (patch.zone || patch.number) {
      setItems((current) =>
        current.map((item) => {
          if (item.zone !== previous.zone || item.shelf !== previous.number)
            return item;
          const nextZone = next.zone;
          const nextPath = `主仓 / ${nextZone}区 / ${String(next.number).padStart(2, "0")}架 / ${item.level}层 / ${String(item.bin).padStart(2, "0")}位`;
          return {
            ...item,
            zone: nextZone,
            shelf: next.number,
            path: nextPath,
          };
        }),
      );
      if (
        selected?.zone === previous.zone &&
        selected.shelf === previous.number
      ) {
        setSelected({
          ...selected,
          zone: next.zone,
          shelf: next.number,
          path: `主仓 / ${next.zone}区 / ${String(next.number).padStart(2, "0")}架 / ${selected.level}层 / ${String(selected.bin).padStart(2, "0")}位`,
        });
      }
    }
  };

  const addShelf = () => {
    const zone: "A" | "B" = "A";
    const nextNumber =
      Math.max(
        0,
        ...shelves
          .filter((item) => item.zone === zone)
          .map((item) => item.number),
      ) + 1;
    const shelf: ShelfConfig = {
      id: `new-${Date.now()}`,
      zone,
      number: nextNumber,
      levels: 3,
      levelHeight: 50,
      column: 2,
      row: 3,
    };
    setShelves((current) => [...current, shelf]);
    setEditingShelfId(shelf.id);
  };

  const locate = (item: DemoItem) => {
    setSelected(item);
    setQuery(item.name);
  };

  const changeVariant = (next: MapVariant) => {
    setVariant(next);
    const url = new URL(window.location.href);
    url.searchParams.set("map", next);
    window.history.replaceState({}, "", url);
  };

  return (
    <main className="spatial-prototype">
      <header className="spatial-topbar">
        <div className="spatial-brand">
          <span>
            <Warehouse size={21} />
          </span>
          <div>
            <b>玉春 YC · 仓库空间定位</b>
            <small>界面原型 · 演示数据，不写入库存</small>
          </div>
        </div>
        <button
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("prototype");
            url.searchParams.delete("map");
            url.searchParams.set("screen", "inventory");
            window.location.href = url.toString();
          }}
        >
          <ChevronLeft size={17} /> 返回库存
        </button>
      </header>

      <section className="spatial-search-panel">
        <div className="spatial-search-title">
          <div>
            <PackageSearch size={24} />
            <span>
              <b>商品在哪？</b>
              <small>输入名称、编号或扫描条码</small>
            </span>
          </div>
          {selected ? (
            <button
              onClick={() => {
                setSelected(null);
                setQuery("");
              }}
            >
              <X size={15} /> 清除定位
            </button>
          ) : null}
        </div>
        <label className="spatial-search-box">
          <Search size={20} />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
            placeholder="例如：柴油滤芯、CX0708、690000070801"
          />
          <button
            disabled={matches.length === 0}
            onClick={() => matches[0] && locate(matches[0])}
          >
            <Crosshair size={18} /> 定位
          </button>
        </label>
        {query && !selected ? (
          <div className="spatial-results">
            {matches.length ? (
              matches.slice(0, 4).map((item) => (
                <button key={item.code} onClick={() => locate(item)}>
                  <span>
                    <b>{item.name}</b>
                    <small>
                      {item.code} · 库存 {item.quantity}
                    </small>
                  </span>
                  <em>{item.path}</em>
                  <ChevronRight size={17} />
                </button>
              ))
            ) : (
              <p>没有找到匹配商品，请换名称、编号或条码。</p>
            )}
          </div>
        ) : null}
        {selected ? (
          <div className="spatial-located-card">
            <span className="located-pulse" />
            <div>
              <small>已定位</small>
              <b>{selected.name}</b>
            </div>
            <strong>{selected.path}</strong>
            <em>现存 {selected.quantity}</em>
          </div>
        ) : (
          <div className="spatial-quick-items">
            <span>快速演示</span>
            {items.slice(0, 3).map((item) => (
              <button key={item.code} onClick={() => locate(item)}>
                {item.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="spatial-map-card">
        <header>
          <div>
            <b>{variantMeta[variant].name}</b>
            <span>{variantMeta[variant].note}</span>
          </div>
          <div className="spatial-legend">
            <span>
              <i className="available" />
              普通库位
            </span>
            <span>
              <i className="target" />
              搜索位置
            </span>
            <button
              className={editingShelf ? "active" : ""}
              onClick={() =>
                editingShelf
                  ? setEditingShelfId(null)
                  : setEditingShelfId(shelves[0]?.id ?? null)
              }
            >
              <PencilRuler size={15} /> 编辑布局
            </button>
            <button onClick={addShelf}>
              <Plus size={15} /> 新增货架
            </button>
          </div>
        </header>
        <div
          className={`${selected ? "has-location" : ""}${editingShelf ? " is-layout-editing" : ""}`}
        >
          {variant === "A" ? (
            <IsometricView
              selected={selected}
              shelves={shelves}
              zoneNames={zoneNames}
              editingShelfId={editingShelfId}
              onEditShelf={setEditingShelfId}
            />
          ) : null}
          {variant === "B" ? <WalkInView selected={selected} /> : null}
          {variant === "C" ? (
            <PlanAndShelfView
              selected={selected}
              shelves={shelves}
              zoneNames={zoneNames}
            />
          ) : null}
          {editingShelf ? (
            <LayoutEditor
              shelf={editingShelf}
              zoneNames={zoneNames}
              onClose={() => setEditingShelfId(null)}
              onChange={updateShelf}
              onZoneNameChange={(zone, name) =>
                setZoneNames((current) => ({ ...current, [zone]: name }))
              }
            />
          ) : null}
        </div>
      </section>

      <nav className="spatial-variant-switcher" aria-label="仓库视图方案">
        {(["A", "B", "C"] as MapVariant[]).map((item) => (
          <button
            className={variant === item ? "active" : ""}
            onClick={() => changeVariant(item)}
            key={item}
          >
            <span>{item}</span>
            <div>
              <b>{variantMeta[item].name}</b>
              <small>{variantMeta[item].note.split(" · ")[0]}</small>
            </div>
          </button>
        ))}
      </nav>
    </main>
  );
}
