import {
  ArrowRight, BadgeDollarSign as BadgeChineseYuan, BarChart3, Bell, Box, Camera, Check, ChevronRight,
  CircleDollarSign, Clock3, Home, Menu, MessageCircle, PackageOpen, Plus, ScanBarcode,
  Search, ShoppingBag, ShoppingCart, Store, Tractor, Truck, UserRound, Users, WalletCards,
} from "lucide-react";
import { debts, metrics, quickProducts, salesLines, type Screen } from "../mockData";

type Props = { screen: Screen; onScreenChange: (screen: Screen) => void };

const mobileNav = [
  ["dashboard", "首页", Home], ["sales", "开单", ShoppingCart],
  ["inventory", "商品", Box], ["debts", "欠款", WalletCards],
] as const;

export function VariantC({ screen, onScreenChange }: Props) {
  return <div className="c-shell">
    <header className="c-header"><div className="c-logo"><span><Tractor/></span><div><small>益农商贸</small><strong>生意助手</strong></div></div><div className="c-search"><Search/><input placeholder="搜商品、客户、欠款"/></div><button className="icon-button"><Bell/><i/></button><button className="c-owner"><span>白</span><div><small>经营者</small><strong>白老板</strong></div></button></header>
    <main className="c-content">
      {screen==="dashboard"&&<CDashboard onScreenChange={onScreenChange}/>}
      {screen==="sales"&&<CSales/>}
      {screen==="inventory"&&<CInventory/>}
      {screen==="debts"&&<CDebts/>}
    </main>
    <nav className="c-nav">{mobileNav.map(([key,label,Icon])=><button key={key} className={screen===key?"active":""} onClick={()=>onScreenChange(key)}><Icon/><span>{label}</span></button>)}<button className="c-scan" onClick={()=>onScreenChange("sales")}><span><ScanBarcode/></span></button></nav>
  </div>;
}

function CDashboard({onScreenChange}:{onScreenChange:(s:Screen)=>void}) {
  return <>
    <section className="c-hero"><div><span>8 月 12 日 · 门店经营正常</span><h1>早上好，白老板 👋</h1><p>今天已完成 8 笔销售，还有 3 笔逾期欠款需要跟进。</p></div><button><BarChart3/>查看经营报告</button></section>
    <section className="c-balance-card"><div><span>今日销售额</span><strong>¥ 18,640<small>.00</small></strong><p><em>↑ 12.8%</em> 比昨日多 ¥2,110</p></div><div className="c-mini-chart">{[35,52,42,68,55,78,88,65,92,75,100,86].map((h,i)=><i key={i} style={{height:`${h}%`}} className={i===10?"active":""}/>)}</div><div className="c-balance-meta"><span><small>今日收款</small><b>¥12,380</b></span><span><small>今日毛利</small><b>¥4,260</b></span></div></section>
    <section className="c-quick-section"><div className="c-section-title"><div><h2>常用功能</h2><p>一步完成日常经营</p></div><button>全部 <ChevronRight/></button></div><div className="c-actions"><button onClick={()=>onScreenChange("sales")}><span className="green"><ScanBarcode/></span><strong>扫码开单</strong><small>快速销售</small></button><button><span className="blue"><Truck/></span><strong>采购入库</strong><small>到货登记</small></button><button onClick={()=>onScreenChange("debts")}><span className="amber"><CircleDollarSign/></span><strong>登记收款</strong><small>核销欠款</small></button><button onClick={()=>onScreenChange("inventory")}><span className="purple"><PackageOpen/></span><strong>库存盘点</strong><small>实盘录入</small></button></div></section>
    <div className="c-dashboard-grid"><section className="c-panel c-todo"><div className="c-section-title"><div><h2>待办提醒</h2><p>按紧急程度排序</p></div><span className="count-badge">5</span></div><button onClick={()=>onScreenChange("debts")}><span className="todo-icon red"><Clock3/></span><div><strong>3 笔客户欠款已逾期</strong><small>合计 ¥18,960，最长逾期 23 天</small></div><ChevronRight/></button><button onClick={()=>onScreenChange("inventory")}><span className="todo-icon orange"><Box/></span><div><strong>38 项商品库存偏低</strong><small>建议今天完成补货检查</small></div><ChevronRight/></button><button><span className="todo-icon blue"><BadgeChineseYuan/></span><div><strong>4 笔收款等待核销</strong><small>合计 ¥12,380</small></div><ChevronRight/></button></section><section className="c-panel c-recent"><div className="c-section-title"><div><h2>最近销售</h2><p>今天 · 8 笔</p></div><button>查看全部 <ChevronRight/></button></div>{[["王建国","09:42","¥ 3,860","微信"],["李明农场","09:12","¥ 8,400","赊账"],["散客","08:48","¥ 560","现金"]].map(r=><div className="c-sale-item" key={r[1]}><span>{r[0][0]}</span><div><strong>{r[0]}</strong><small>{r[1]} · {r[3]}</small></div><b>{r[2]}</b></div>)}</section></div>
  </>;
}

function CPageHead({eyebrow,title,description}:{eyebrow:string;title:string;description:string}) {return <div className="c-page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>}

function CSales() {
  const total=salesLines.reduce((s,l)=>s+l.total,0)-8;
  return <><CPageHead eyebrow="快速开单 · 模拟状态" title="新建销售单" description="像收银一样简单，服务端接入后才会正式过账。"/><div className="c-sale-flow"><section className="c-panel c-customer-card"><div><span className="todo-icon green"><UserRound/></span><div><small>销售客户</small><strong>王建国</strong><p>欠款 ¥12,350 · 正常账期</p></div></div><button>更换<ChevronRight/></button></section><section className="c-panel c-add-product"><button className="c-camera"><Camera/></button><div><strong>扫码或搜索添加商品</strong><small>支持条码、型号、名称、适配机型</small></div><button className="c-search-add"><Search/></button></section><section className="c-panel c-mobile-lines"><div className="c-section-title"><div><h2>已选商品</h2><p>3 种 · 64 件</p></div><button><Plus/>添加</button></div>{salesLines.map(l=><div className="c-line" key={l.name}><span className="c-product-icon"><Tractor/></span><div><strong>{l.name}</strong><small>{l.spec} · ¥{l.price}/{l.unit}</small><div className="c-qty"><button>−</button><b>{l.qty}</b><button>+</button></div></div><b>¥ {l.total.toFixed(2)}</b></div>)}</section><section className="c-panel c-mobile-settle"><p><span>商品金额</span><b>¥ {(total+8).toFixed(2)}</b></p><p><span>优惠</span><b>− ¥ 8.00</b></p><div><span>本单应收</span><strong>¥ {total.toFixed(2)}</strong></div><div className="c-pay-buttons"><button className="active">微信</button><button>现金</button><button>赊账</button></div><button className="c-submit"><Check/>确认收款并过账</button></section></div></>;
}

function CInventory(){return <><CPageHead eyebrow="商品与库存" title="店里的货" description="按名称、条码、规格和适配机型快速找到商品。"/><div className="c-inventory-top"><div className="c-search"><Search/><input placeholder="搜商品或扫条码"/></div><button><ScanBarcode/></button></div><div className="c-category-pills"><button className="active">全部 4,286</button><button>整机 42</button><button>配件 1,860</button><button>螺丝 2,184</button></div><section className="c-product-list">{quickProducts.map((p,i)=><article key={p.sku}><span className="c-product-photo" style={{background:p.color}}><Tractor/></span><div><span className="product-tag">{p.tag}</span><strong>{p.name}</strong><small>{p.sku}</small><p><b>{p.price}</b><span className={i===3?"low":""}>库存 {p.stock}</span></p></div><button><ChevronRight/></button></article>)}</section><button className="c-fab"><Plus/>新增商品</button></>}

function CDebts(){return <><CPageHead eyebrow="往来账 · 客户应收" title="欠款跟进" description="按风险排序，联系、对账、收款一步完成。"/><section className="c-debt-overview"><div><span>客户欠款总额</span><strong>¥ 86,420</strong><small>26 位欠款客户</small></div><span className="c-overdue"><small>已逾期</small><b>¥18,960</b><em>3 人</em></span></section><div className="c-debt-tabs"><button className="active">全部</button><button>已逾期 3</button><button>今日到期 1</button><button>正常账期</button></div><section className="c-debt-cards">{debts.map(d=><article key={d.name}><div className="c-debt-head"><span className={`debt-avatar ${d.level}`}>{d.name[0]}</span><div><strong>{d.name}</strong><small>{d.contact}</small></div><span className={`due-text ${d.level}`}>{d.due}</span></div><div className="c-debt-money"><span><small>欠款余额</small><strong>{d.amount}</strong></span><span><small>最近交易</small><b>8 月 10 日</b></span></div><div className="c-debt-actions"><button><MessageCircle/>联系客户</button><button><CircleDollarSign/>登记收款</button><button>对账单<ArrowRight/></button></div></article>)}</section></>}
