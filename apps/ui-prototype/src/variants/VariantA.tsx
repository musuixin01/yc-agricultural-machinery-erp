import {
  Bell, Box, ChevronDown, CircleDollarSign, ClipboardList, Cloud, LayoutDashboard,
  Menu, PackageCheck, Plus, ScanLine, Search, Settings, ShoppingCart, Store,
  Tractor, TrendingUp, Truck, UsersRound, WalletCards,
} from "lucide-react";
import { activities, debts, metrics, quickProducts, salesLines, type Screen } from "../mockData";

type Props = { screen: Screen; onScreenChange: (screen: Screen) => void };

const nav = [
  ["dashboard", "工作台", LayoutDashboard], ["sales", "销售开单", ShoppingCart],
  ["inventory", "商品库存", Box], ["debts", "往来欠款", WalletCards],
] as const;

export function VariantA({ screen, onScreenChange }: Props) {
  return (
    <div className="a-shell">
      <aside className="a-sidebar">
        <div className="a-brand"><span className="a-brandmark"><Tractor size={22} /></span><div><strong>益农商贸</strong><small>农机 ERP</small></div></div>
        <nav className="a-nav">
          <p>经营管理</p>
          {nav.map(([key, label, Icon]) => <button key={key} className={screen === key ? "active" : ""} onClick={() => onScreenChange(key)}><Icon size={18}/><span>{label}</span>{key === "debts" && <em>4</em>}</button>)}
          <p>业务协作</p>
          <button><Truck size={18}/><span>采购入库</span></button>
          <button><UsersRound size={18}/><span>客户供应商</span></button>
          <button><TrendingUp size={18}/><span>经营报表</span></button>
        </nav>
        <div className="a-sidebar-foot"><div className="a-cloud"><Cloud size={16}/><span><strong>云端账本正常</strong><small>刚刚完成同步</small></span></div><button><Settings size={18}/>系统设置</button></div>
      </aside>
      <main className="a-main">
        <header className="a-topbar">
          <button className="a-mobile-menu"><Menu size={20}/></button>
          <div className="a-search"><Search size={18}/><input placeholder="搜索商品、客户、单据..."/><kbd>Ctrl K</kbd></div>
          <div className="a-top-actions"><button className="icon-button"><Bell size={19}/><i/></button><button className="a-user"><span>白</span><div><strong>白老板</strong><small>经营者</small></div><ChevronDown size={15}/></button></div>
        </header>
        <div className="a-content">
          {screen === "dashboard" && <ADashboard onScreenChange={onScreenChange}/>}
          {screen === "sales" && <ASales/>}
          {screen === "inventory" && <AInventory/>}
          {screen === "debts" && <ADebts/>}
        </div>
      </main>
      <nav className="a-mobile-nav">{nav.map(([key, label, Icon]) => <button key={key} className={screen === key ? "active" : ""} onClick={() => onScreenChange(key)}><Icon size={19}/><span>{label.slice(0, 2)}</span></button>)}</nav>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="a-intro"><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{action}</div>;
}

function ADashboard({ onScreenChange }: { onScreenChange: (screen: Screen) => void }) {
  return <>
    <PageIntro eyebrow="2026 年 8 月 12 日 · 星期三" title="早上好，白老板" description="门店经营正常，今天有 3 项需要您关注。" action={<button className="primary-button" onClick={() => onScreenChange("sales")}><Plus size={17}/>新建销售单</button>}/>
    <section className="a-metrics">{metrics.map((item, index) => <article key={item.label}><div className={`metric-icon ${item.tone}`}>{[<CircleDollarSign/>, <PackageCheck/>, <WalletCards/>, <Box/>][index]}</div><p>{item.label}</p><strong>{item.value}</strong><small className={item.tone}>{item.delta}</small></article>)}</section>
    <section className="a-dashboard-grid">
      <article className="a-panel a-chart-panel"><div className="panel-heading"><div><h2>经营趋势</h2><p>近 7 天销售与收款</p></div><select><option>近 7 天</option></select></div><div className="a-chart"><div className="chart-y"><span>20k</span><span>15k</span><span>10k</span><span>5k</span><span>0</span></div><div className="chart-area"><svg viewBox="0 0 640 210" preserveAspectRatio="none"><defs><linearGradient id="fillA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d7d55" stopOpacity=".25"/><stop offset="1" stopColor="#3d7d55" stopOpacity="0"/></linearGradient></defs><path className="fill" d="M0 170 C70 145 85 80 150 112 S240 155 305 95 S390 125 455 52 S550 102 640 25 L640 210 L0 210Z"/><path className="line" d="M0 170 C70 145 85 80 150 112 S240 155 305 95 S390 125 455 52 S550 102 640 25"/><path className="line secondary" d="M0 185 C65 170 90 130 150 150 S245 115 305 132 S390 90 455 112 S550 70 640 82"/></svg><div className="chart-labels"><span>8/06</span><span>8/07</span><span>8/08</span><span>8/09</span><span>8/10</span><span>8/11</span><span>今天</span></div></div></div><div className="chart-legend"><span><i className="sales-dot"/>销售额 ¥96,780</span><span><i className="pay-dot"/>收款额 ¥78,240</span></div></article>
      <article className="a-panel"><div className="panel-heading"><div><h2>欠款提醒</h2><p>优先联系即将或已经逾期客户</p></div><button className="text-button" onClick={() => onScreenChange("debts")}>查看全部</button></div><div className="a-debt-list">{debts.slice(0,3).map(d => <div key={d.name}><span className={`debt-avatar ${d.level}`}>{d.name.slice(0,1)}</span><div><strong>{d.name}</strong><small>{d.due}</small></div><b>{d.amount}</b></div>)}</div></article>
      <article className="a-panel a-activity"><div className="panel-heading"><div><h2>经营动态</h2><p>门店最新业务记录</p></div><button className="icon-button"><ClipboardList size={18}/></button></div>{activities.map(a => <div className="activity-row" key={a.time}><time>{a.time}</time><i className={a.type}/><div><strong>{a.title}</strong><small>{a.meta}</small></div></div>)}</article>
      <article className="a-panel a-quick"><div className="panel-heading"><div><h2>快捷操作</h2><p>高频业务一步直达</p></div></div><div className="quick-grid"><button onClick={() => onScreenChange("sales")}><ScanLine/><span><strong>扫码开单</strong><small>快速销售</small></span></button><button><Truck/><span><strong>采购入库</strong><small>到货登记</small></span></button><button onClick={() => onScreenChange("inventory")}><Box/><span><strong>库存盘点</strong><small>录入实盘</small></span></button><button onClick={() => onScreenChange("debts")}><CircleDollarSign/><span><strong>登记收款</strong><small>核销欠款</small></span></button></div></article>
    </section>
  </>;
}

function ASales() {
  const subtotal = salesLines.reduce((sum, item) => sum + item.total, 0);
  return <><PageIntro eyebrow="销售管理 / 新建销售单" title="快速销售开单" description="模拟界面，不会正式扣减库存或产生应收。" action={<button className="outline-button"><ScanLine size={17}/>扫码枪已就绪</button>}/><div className="sales-layout"><section className="a-panel sale-products"><div className="sale-toolbar"><div className="large-search"><Search/><input placeholder="输入名称、条码、型号或助记码" autoFocus/></div><button><ScanLine/></button></div><div className="product-grid">{quickProducts.map(p => <button key={p.sku} className="product-card"><span className="product-visual" style={{background:p.color}}><Tractor size={34}/><i>{p.tag}</i></span><strong>{p.name}</strong><small>{p.sku} · 库存 {p.stock}</small><b>{p.price}</b></button>)}</div></section><aside className="a-panel sale-cart"><div className="cart-customer"><span>客户</span><button><UsersRound size={18}/>王建国<ChevronDown size={15}/></button></div><div className="cart-lines">{salesLines.map((line, i) => <div key={line.name}><span className="line-index">{i+1}</span><div><strong>{line.name}</strong><small>{line.spec}</small><p><button>−</button><span>{line.qty} {line.unit}</span><button>＋</button></p></div><b>¥ {line.total.toFixed(2)}</b></div>)}</div><div className="cart-summary"><p><span>商品金额</span><b>¥ {subtotal.toFixed(2)}</b></p><p><span>整单优惠</span><b>− ¥ 8.00</b></p><p className="grand"><span>应收合计</span><strong>¥ {(subtotal-8).toFixed(2)}</strong></p><button className="checkout-button">结算并过账 <span>¥ {(subtotal-8).toFixed(2)}</span></button></div></aside></div></>;
}

function AInventory() {
  return <><PageIntro eyebrow="商品库存 / 商品列表" title="商品与库存" description="共 4,286 个商品，38 项低于安全库存。" action={<button className="primary-button"><Plus size={17}/>新增商品</button>}/><section className="a-panel table-panel"><div className="table-toolbar"><div className="a-search"><Search size={18}/><input placeholder="搜索商品、型号、条码"/></div><button className="filter-button">全部分类<ChevronDown size={15}/></button><button className="filter-button">主仓库<ChevronDown size={15}/></button></div><div className="responsive-table"><table><thead><tr><th>商品</th><th>分类</th><th>当前库存</th><th>安全库存</th><th>零售价</th><th>库存状态</th></tr></thead><tbody>{quickProducts.map((p,i)=><tr key={p.sku}><td><div className="table-product"><span style={{background:p.color}}><Tractor size={20}/></span><div><strong>{p.name}</strong><small>{p.sku}</small></div></div></td><td>{p.tag}</td><td><b>{p.stock}</b></td><td>{[1,100,500,30][i]} {p.stock.split(" ")[1]}</td><td>{p.price}</td><td><span className={`status-pill ${i===3 ? "low":"ok"}`}>{i===3 ? "库存偏低":"库存正常"}</span></td></tr>)}</tbody></table></div></section></>;
}

function ADebts() {
  return <><PageIntro eyebrow="往来账 / 客户欠款" title="客户欠款" description="所有余额均可追溯到销售单、收款与核销记录。" action={<button className="primary-button"><Plus size={17}/>登记收款</button>}/><div className="debt-summary"><article><span>应收总额</span><strong>¥ 86,420</strong><small>26 位欠款客户</small></article><article className="late"><span>已逾期</span><strong>¥ 18,960</strong><small>需要优先跟进</small></article><article><span>30 天内到期</span><strong>¥ 35,240</strong><small>12 笔未结销售单</small></article></div><section className="a-panel debt-table"><div className="table-toolbar"><div className="a-search"><Search size={18}/><input placeholder="搜索客户名称或手机号"/></div><button className="filter-button">全部账龄<ChevronDown size={15}/></button></div>{debts.map(d=><div className="debt-row" key={d.name}><span className={`debt-avatar ${d.level}`}>{d.name.slice(0,1)}</span><div><strong>{d.name}</strong><small>{d.contact}</small></div><span className={`due-text ${d.level}`}>{d.due}</span><b>{d.amount}</b><button className="outline-button">查看对账</button></div>)}</section></>;
}
