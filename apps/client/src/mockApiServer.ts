import type { Connect } from "vite";

interface ServerState {
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    status: "ACTIVE" | "LOCKED" | "INACTIVE";
    roles: string[];
    permissions: string[];
    passwordHash?: string;
    createdAt: string;
  }>;
  units: Array<{
    id: string;
    code: string;
    name: string;
    decimalScale: number;
  }>;
  categories: Array<{
    id: string;
    code: string;
    name: string;
    sortOrder: number;
  }>;
  brands: Array<{ id: string; code: string; name: string }>;
  products: Array<any>;
  parties: Array<any>;
  warehouses: Array<any>;
  cashAccounts: Array<any>;
  salesDocuments: Array<any>;
  salesReturns: Array<any>;
  purchasingReturns: Array<any>;
  purchasingReceipts: Array<any>;
  inventoryLedger: Array<any>;
  inventoryBalances: Array<any>;
  openingDocuments: Array<any>;
  stocktakes: Array<any>;
  damages: Array<any>;
  transfers: Array<any>;
  payablesEntries: Array<any>;
  payablesPayments: Array<any>;
  payablesAdvances: Array<any>;
  receivablesEntries: Array<any>;
  receivablesReceipts: Array<any>;
  receivablesAdvances: Array<any>;
  cashTransfers: Array<any>;
  auditLogs: Array<any>;
  businessProfile: any;
  backupPolicy: any;
  backups: Array<any>;
}

function createInitialState(): ServerState {
  const units = [
    { id: "u-set", code: "SET", name: "台", decimalScale: 0 },
    { id: "u-piece", code: "PIECE", name: "片", decimalScale: 0 },
    { id: "u-pcs", code: "PCS", name: "个", decimalScale: 0 },
    { id: "u-box", code: "BOX", name: "箱", decimalScale: 0 },
    { id: "u-bottle", code: "BOTTLE", name: "桶", decimalScale: 0 },
  ];

  const categories = [
    { id: "c-machine", code: "MACHINE", name: "农机整机", sortOrder: 10 },
    { id: "c-part", code: "PART", name: "农机配件", sortOrder: 20 },
    { id: "c-fastener", code: "FASTENER", name: "螺丝标准件", sortOrder: 30 },
    { id: "c-consumable", code: "CONSUMABLE", name: "油品耗材", sortOrder: 40 },
  ];

  const brands = [
    { id: "b-dfh", code: "DFH", name: "东方红" },
    { id: "b-lovol", code: "LOVOL", name: "雷沃" },
    { id: "b-generic", code: "GENERIC", name: "通用" },
    { id: "b-greatwall", code: "GREATWALL", name: "长城润滑油" },
  ];

  const products = [
    {
      id: "p-dfh-lx904",
      code: "ZJ-DFH-LX904",
      name: "东方红 LX904 轮式拖拉机",
      mnemonicCode: "DFHLX904",
      type: "MACHINE",
      model: "LX904",
      specification: "90马力 / 四驱 / 强压入土",
      category: { id: "c-machine", code: "MACHINE", name: "农机整机" },
      brand: { id: "b-dfh", code: "DFH", name: "东方红" },
      baseUnit: { id: "u-set", code: "SET", name: "台", decimalScale: 0 },
      retailPrice: "126800.00",
      wholesalePrice: "119000.00",
      defaultPurchasePrice: "108000.00",
      minimumSalePrice: "115000.00",
      safetyStock: "2",
      barcodes: [{ id: "bc-1", barcode: "ZJDFHLX904", isPrimary: true }],
      status: "ACTIVE",
      version: 1,
      attributes: {},
    },
    {
      id: "p-xg-0245",
      code: "PJ-XG-0245",
      name: "旋耕机刀片 245 型",
      mnemonicCode: "XGJDP245",
      type: "PART",
      model: "245型",
      specification: "高耐磨65Mn锰钢 / 右弯",
      category: { id: "c-part", code: "PART", name: "农机配件" },
      brand: { id: "b-generic", code: "GENERIC", name: "通用" },
      baseUnit: { id: "u-piece", code: "PIECE", name: "片", decimalScale: 0 },
      retailPrice: "28.00",
      wholesalePrice: "22.50",
      defaultPurchasePrice: "16.80",
      minimumSalePrice: "20.00",
      safetyStock: "100",
      barcodes: [{ id: "bc-2", barcode: "PJXG0245", isPrimary: true }],
      status: "ACTIVE",
      version: 1,
      attributes: {},
    },
    {
      id: "p-ls-m12-045",
      code: "LS-M12-045",
      name: "高强度法兰面螺栓 M12×45",
      mnemonicCode: "GQDLSM1245",
      type: "STANDARD_PART",
      model: "M12*45",
      specification: "10.9级高强 / 达克罗防锈",
      category: { id: "c-fastener", code: "FASTENER", name: "螺丝标准件" },
      brand: { id: "b-generic", code: "GENERIC", name: "通用" },
      baseUnit: { id: "u-pcs", code: "PCS", name: "个", decimalScale: 0 },
      retailPrice: "2.50",
      wholesalePrice: "1.80",
      defaultPurchasePrice: "1.10",
      minimumSalePrice: "1.50",
      safetyStock: "600",
      barcodes: [{ id: "bc-3", barcode: "LSM12045", isPrimary: true }],
      status: "ACTIVE",
      version: 1,
      attributes: {},
    },
    {
      id: "p-lx-0708",
      code: "PJ-LX-0708",
      name: "柴油精滤滤芯 CX0708",
      mnemonicCode: "CYJLLX0708",
      type: "CONSUMABLE",
      model: "CX0708",
      specification: "适配东方红 / 潍柴 / 雷沃",
      category: { id: "c-consumable", code: "CONSUMABLE", name: "油品耗材" },
      brand: { id: "b-generic", code: "GENERIC", name: "通用" },
      baseUnit: { id: "u-pcs", code: "PCS", name: "个", decimalScale: 0 },
      retailPrice: "42.00",
      wholesalePrice: "35.00",
      defaultPurchasePrice: "24.00",
      minimumSalePrice: "30.00",
      safetyStock: "40",
      barcodes: [{ id: "bc-4", barcode: "PJLX0708", isPrimary: true }],
      status: "ACTIVE",
      version: 1,
      attributes: {},
    },
    {
      id: "p-oil-15w40",
      code: "YP-CC-15W40",
      name: "长城尊龙柴油机油 15W-40 CI-4 (18L)",
      mnemonicCode: "CCZL15W40",
      type: "CONSUMABLE",
      model: "18L",
      specification: "CI-4级 / 重负荷农机专用",
      category: { id: "c-consumable", code: "CONSUMABLE", name: "油品耗材" },
      brand: { id: "b-greatwall", code: "GREATWALL", name: "长城润滑油" },
      baseUnit: { id: "u-bottle", code: "BOTTLE", name: "桶", decimalScale: 0 },
      retailPrice: "320.00",
      wholesalePrice: "275.00",
      defaultPurchasePrice: "230.00",
      minimumSalePrice: "260.00",
      safetyStock: "20",
      barcodes: [{ id: "bc-5", barcode: "YPCC15W40", isPrimary: true }],
      status: "ACTIVE",
      version: 1,
      attributes: {},
    },
  ];

  const parties = [
    {
      id: "pt-lm",
      code: "KH-0001",
      name: "李明家庭农场",
      shortName: "李明农场",
      role: "CUSTOMER",
      roles: ["CUSTOMER"],
      phone: "13856232268",
      address: "玉春县向阳镇李家庄3组",
      province: "山东省",
      city: "临沂市",
      taxId: "92371300MA3X89QW21",
      contactPerson: "李明",
      contacts: [
        {
          id: "ct-lm-1",
          name: "李明",
          phone: "13856232268",
          email: "liming_farm@163.com",
          position: "农场场长",
          isPrimary: true,
        },
      ],
      creditLimit: "50000.00",
      paymentTermsDays: 30,
      paymentTermsMonths: 0,
      receivableBalance: "18600.00",
      payableBalance: "0.00",
      notes: "老客户，信誉良好，常购大中型农机配件",
      status: "ACTIVE",
      version: 1,
    },
    {
      id: "pt-wjg",
      code: "KH-0002",
      name: "王建国农机作业队",
      shortName: "王建国",
      role: "CUSTOMER",
      roles: ["CUSTOMER"],
      phone: "13690185071",
      address: "玉春县双河镇农机站东侧",
      province: "山东省",
      city: "临沂市",
      taxId: "92371300MA3Y99AB12",
      contactPerson: "王建国",
      contacts: [
        {
          id: "ct-wjg-1",
          name: "王建国",
          phone: "13690185071",
          email: "wjg_machinery@qq.com",
          position: "队长",
          isPrimary: true,
        },
      ],
      creditLimit: "30000.00",
      paymentTermsDays: 15,
      paymentTermsMonths: 0,
      receivableBalance: "12350.00",
      payableBalance: "0.00",
      notes: "跨区作业队，秋收季集中采购",
      status: "ACTIVE",
      version: 1,
    },
    {
      id: "pt-fs",
      code: "KH-0003",
      name: "玉春县丰收农机专业合作社",
      shortName: "丰收合作社",
      role: "CUSTOMER",
      roles: ["CUSTOMER"],
      phone: "15933413046",
      address: "玉春县城关镇丰收大道8号",
      province: "山东省",
      city: "临沂市",
      taxId: "93371300MA4Z11CD34",
      contactPerson: "赵经理",
      contacts: [
        {
          id: "ct-fs-1",
          name: "赵经理",
          phone: "15933413046",
          email: "fengshou_coop@126.com",
          position: "理事长",
          isPrimary: true,
        },
      ],
      creditLimit: "80000.00",
      paymentTermsDays: 45,
      paymentTermsMonths: 0,
      receivableBalance: "9820.00",
      payableBalance: "0.00",
      notes: "大型合作社，机具较多，结算稳定",
      status: "ACTIVE",
      version: 1,
    },
    {
      id: "pt-dfh",
      code: "GYS-0001",
      name: "一拖（洛阳）农机配件销售总公司",
      shortName: "一拖洛阳总厂",
      role: "SUPPLIER",
      roles: ["SUPPLIER"],
      phone: "0379-64968888",
      address: "河南省洛阳市涧西区建设路154号",
      province: "河南省",
      city: "洛阳市",
      taxId: "91410300171122334A",
      contactPerson: "张部长",
      contacts: [
        {
          id: "ct-dfh-1",
          name: "张部长",
          phone: "0379-64968888",
          email: "zhang_sales@ytogroup.com",
          position: "华东大区经理",
          isPrimary: true,
        },
      ],
      creditLimit: "200000.00",
      paymentTermsDays: 60,
      paymentTermsMonths: 0,
      receivableBalance: "0.00",
      payableBalance: "45000.00",
      notes: "一级原厂供货商，每月25日对账结款",
      status: "ACTIVE",
      version: 1,
    },
    {
      id: "pt-hd",
      code: "GYS-0002",
      name: "河北宏达农机配件制造有限公司",
      shortName: "宏达配件",
      role: "SUPPLIER",
      roles: ["SUPPLIER"],
      phone: "0311-88765432",
      address: "河北省石家庄市工业园B区",
      province: "河北省",
      city: "石家庄市",
      taxId: "91130100778899001B",
      contactPerson: "刘厂长",
      contacts: [
        {
          id: "ct-hd-1",
          name: "刘厂长",
          phone: "0311-88765432",
          email: "hongda_part@163.com",
          position: "销售副总",
          isPrimary: true,
        },
      ],
      creditLimit: "100000.00",
      paymentTermsDays: 30,
      paymentTermsMonths: 0,
      receivableBalance: "0.00",
      payableBalance: "28400.00",
      notes: "齿轮与传动轴优质供应商",
      status: "ACTIVE",
      version: 1,
    },
  ];

  const warehouses = [
    {
      id: "wh-main",
      code: "CK-01",
      name: "1号总仓库",
      address: "玉春农机大市场南区 1-4 号库房",
      isDefault: true,
      status: "ACTIVE",
      version: 1,
      locations: [
        { id: "loc-1", code: "A-01", name: "整机展示区" },
        { id: "loc-2", code: "B-01", name: "配件货架A区" },
        { id: "loc-3", code: "C-01", name: "油品标准库" },
      ],
    },
    {
      id: "wh-sub",
      code: "CK-02",
      name: "农机配件专库",
      address: "玉春农机大市场北区配件楼 102",
      isDefault: false,
      status: "ACTIVE",
      version: 1,
      locations: [{ id: "loc-4", code: "PJ-01", name: "易损件专柜" }],
    },
  ];

  const cashAccounts = [
    {
      id: "ca-main",
      code: "ZH-01",
      name: "建设银行企业主账户",
      type: "BANK",
      balance: "286450.00",
      accountNumber: "6217 **** **** 8826",
      isDefault: true,
    },
    {
      id: "ca-wechat",
      code: "ZH-02",
      name: "微信商业收款商户号",
      type: "WECHAT",
      balance: "48320.00",
      accountNumber: "1689230491",
      isDefault: false,
    },
    {
      id: "ca-alipay",
      code: "ZH-03",
      name: "支付宝对公收款",
      type: "ALIPAY",
      balance: "35600.00",
      accountNumber: "yc_machinery@163.com",
      isDefault: false,
    },
    {
      id: "ca-cash",
      code: "ZH-04",
      name: "门店前台现金保险箱",
      type: "CASH",
      balance: "8500.00",
      accountNumber: "CASH-STORE-01",
      isDefault: false,
    },
  ];

  const inventoryBalances = [
    {
      id: "ib-1",
      product: {
        id: "p-dfh-lx904",
        code: "ZJ-DFH-LX904",
        name: "东方红 LX904 轮式拖拉机",
        categoryName: "农机整机",
        unitName: "台",
        safetyStock: "2",
      },
      warehouse: { id: "wh-main", code: "CK-01", name: "1号总仓库" },
      quantity: "3",
      totalCost: "324000.00",
      averageCost: "108000.00",
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ib-2",
      product: {
        id: "p-xg-0245",
        code: "PJ-XG-0245",
        name: "旋耕机刀片 245 型",
        categoryName: "农机配件",
        unitName: "片",
        safetyStock: "100",
      },
      warehouse: { id: "wh-main", code: "CK-01", name: "1号总仓库" },
      quantity: "280",
      totalCost: "4704.00",
      averageCost: "16.80",
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ib-3",
      product: {
        id: "p-ls-m12-045",
        code: "LS-M12-045",
        name: "高强度法兰面螺栓 M12×45",
        categoryName: "螺丝标准件",
        unitName: "个",
        safetyStock: "600",
      },
      warehouse: { id: "wh-main", code: "CK-01", name: "1号总仓库" },
      quantity: "1450",
      totalCost: "1595.00",
      averageCost: "1.10",
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ib-4",
      product: {
        id: "p-lx-0708",
        code: "PJ-LX-0708",
        name: "柴油精滤滤芯 CX0708",
        categoryName: "油品耗材",
        unitName: "个",
        safetyStock: "40",
      },
      warehouse: { id: "wh-main", code: "CK-01", name: "1号总仓库" },
      quantity: "24",
      totalCost: "576.00",
      averageCost: "24.00",
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ib-5",
      product: {
        id: "p-oil-15w40",
        code: "YP-CC-15W40",
        name: "长城尊龙柴油机油 15W-40 CI-4 (18L)",
        categoryName: "油品耗材",
        unitName: "桶",
        safetyStock: "20",
      },
      warehouse: { id: "wh-main", code: "CK-01", name: "1号总仓库" },
      quantity: "38",
      totalCost: "8740.00",
      averageCost: "230.00",
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  const salesDocuments = [
    {
      id: "sd-1",
      documentNumber: "XS-20260901-0001",
      status: "POSTED",
      settlementType: "IMMEDIATE",
      businessDate: "2026-09-01",
      soldAt: new Date().toISOString(),
      dueDate: "2026-09-01",
      totalAmount: "18640.00",
      totalCost: "12400.00",
      grossProfit: "6240.00",
      version: 1,
      customerNameSnapshot: "王建国农机作业队",
      customerPhoneSnapshot: "13690185071",
      customer: {
        id: "pt-wjg",
        code: "KH-0002",
        name: "王建国农机作业队",
        phone: "13690185071",
      },
      warehouse: { id: "wh-main", code: "CK-01", name: "1号总仓库" },
      cashAccount: {
        id: "ca-wechat",
        code: "ZH-02",
        name: "微信商业收款商户号",
        type: "WECHAT",
      },
      postedBy: { id: "u-owner", displayName: "白老板" },
      receivableEntry: null,
      reversal: null,
      lines: [
        {
          id: "sdl-1",
          product: {
            id: "p-xg-0245",
            code: "PJ-XG-0245",
            name: "旋耕机刀片 245 型",
          },
          quantity: "24",
          unitPrice: "28.00",
          lineAmount: "672.00",
          unitCost: "16.80",
          costAmount: "403.20",
          grossProfit: "268.80",
          unitNameSnapshot: "片",
        },
        {
          id: "sdl-2",
          product: {
            id: "p-oil-15w40",
            code: "YP-CC-15W40",
            name: "长城尊龙柴油机油 15W-40 CI-4 (18L)",
          },
          quantity: "5",
          unitPrice: "320.00",
          lineAmount: "1600.00",
          unitCost: "230.00",
          costAmount: "1150.00",
          grossProfit: "450.00",
          unitNameSnapshot: "桶",
        },
      ],
    },
  ];

  const nowStr = new Date().toISOString();

  return {
    users: [
      {
        id: "u-owner",
        username: "owner",
        displayName: "白老板",
        status: "ACTIVE",
        roles: ["OWNER"],
        permissions: ["*"],
        createdAt: nowStr,
      },
      {
        id: "u-sales",
        username: "sales01",
        displayName: "小张",
        status: "ACTIVE",
        roles: ["SALES"],
        permissions: ["sales:*", "catalog:read", "parties:*"],
        createdAt: nowStr,
      },
    ],
    units,
    categories,
    brands,
    products,
    parties,
    warehouses,
    cashAccounts,
    salesDocuments,
    salesReturns: [],
    purchasingReturns: [],
    purchasingReceipts: [],
    inventoryLedger: [
      {
        id: "leg-1",
        sourceDocumentId: "sd-1",
        sourceDocumentType: "CASH_SALE",
        sourceDocumentNumber: "XS-20260901-0001",
        product: {
          id: "p-xg-0245",
          code: "PJ-XG-0245",
          name: "旋耕机刀片 245 型",
          unitName: "片",
        },
        warehouse: { id: "wh-main", code: "CK-01", name: "1号总仓库" },
        location: null,
        quantityChange: "-24",
        unitCost: "16.80",
        costAmount: "-403.20",
        businessDate: "2026-09-01",
        postedAt: nowStr,
        postedBy: { id: "u-owner", displayName: "白老板" },
      },
    ],
    inventoryBalances,
    openingDocuments: [],
    stocktakes: [],
    damages: [],
    transfers: [
      {
        id: "tr-sample-1",
        documentNumber: "DB-20260901-0001",
        status: "POSTED",
        businessDate: "2026-09-01",
        notes: "主库向农机配件专库常规调拨备货",
        version: 1,
        totalAmount: "336.00",
        sourceWarehouse: {
          id: "wh-main",
          code: "CK-01",
          name: "1号总仓库",
        },
        targetWarehouse: {
          id: "wh-sub",
          code: "CK-02",
          name: "农机配件专库",
        },
        createdBy: { id: "u-owner", displayName: "白老板" },
        submittedBy: { id: "u-owner", displayName: "白老板" },
        postedBy: { id: "u-owner", displayName: "白老板" },
        submittedAt: "2026-09-01T08:30:00.000Z",
        postedAt: "2026-09-01T08:35:00.000Z",
        lines: [
          {
            id: "trl-1",
            product: {
              id: "p-xg-0245",
              code: "PJ-XG-0245",
              name: "旋耕机刀片 245 型",
            },
            productNameSnapshot: "旋耕机刀片 245 型",
            unitNameSnapshot: "片",
            quantity: "20",
            unitCost: "16.80",
            lineAmount: "336.00",
          },
        ],
      },
    ],
    payablesEntries: [
      {
        id: "pe-1",
        supplier: {
          id: "pt-dfh",
          code: "GYS-0001",
          name: "一拖（洛阳）农机配件销售总公司",
          phone: "0379-64968888",
        },
        sourceDocument: {
          documentNumber: "CG-20260815-0003",
          receivedAt: "2026-08-15T10:00:00.000Z",
        },
        originalAmount: "45000.00",
        outstandingAmount: "45000.00",
        dueDate: "2026-09-15",
        status: "OPEN",
      },
      {
        id: "pe-2",
        supplier: {
          id: "pt-hd",
          code: "GYS-0002",
          name: "河北宏达农机配件制造有限公司",
          phone: "0311-88765432",
        },
        sourceDocument: {
          documentNumber: "CG-20260822-0007",
          receivedAt: "2026-08-22T14:30:00.000Z",
        },
        originalAmount: "28400.00",
        outstandingAmount: "28400.00",
        dueDate: "2026-09-22",
        status: "OPEN",
      },
    ],
    payablesPayments: [],
    payablesAdvances: [],
    receivablesEntries: [
      {
        id: "rec-1",
        customer: {
          id: "pt-lm",
          code: "KH-0001",
          name: "李明家庭农场",
          phone: "13856232268",
        },
        sourceDocument: {
          documentNumber: "XS-20260820-0008",
          soldAt: "2026-08-20T09:15:00.000Z",
        },
        originalAmount: "18600.00",
        outstandingAmount: "18600.00",
        dueDate: "2026-08-30",
        status: "OPEN",
      },
      {
        id: "rec-2",
        customer: {
          id: "pt-wjg",
          code: "KH-0002",
          name: "王建国农机作业队",
          phone: "13690185071",
        },
        sourceDocument: {
          documentNumber: "XS-20260825-0012",
          soldAt: "2026-08-25T15:20:00.000Z",
        },
        originalAmount: "12350.00",
        outstandingAmount: "12350.00",
        dueDate: "2026-09-10",
        status: "OPEN",
      },
      {
        id: "rec-3",
        customer: {
          id: "pt-fs",
          code: "KH-0003",
          name: "玉春县丰收农机专业合作社",
          phone: "15933413046",
        },
        sourceDocument: {
          documentNumber: "XS-20260828-0015",
          soldAt: "2026-08-28T11:40:00.000Z",
        },
        originalAmount: "9820.00",
        outstandingAmount: "9820.00",
        dueDate: "2026-09-02",
        status: "OPEN",
      },
    ],
    receivablesReceipts: [],
    receivablesAdvances: [],
    cashTransfers: [],
    auditLogs: [
      {
        id: "aud-1",
        action: "AUTH_LOGIN",
        module: "AUTH",
        actor: { id: "u-owner", displayName: "白老板" },
        timestamp: nowStr,
        ip: "127.0.0.1",
        detail: "管理员登录系统",
      },
    ],
    businessProfile: {
      id: "bp-main",
      storeName: "玉春农机经营管理部",
      shortName: "玉春农机",
      phone: "0551-88889999 / 13800008888",
      address: "安徽省玉春县农机大市场南区 1-4 展厅",
      receiptFooter:
        "玉春农机 · 祝您秋收大吉！凭此单保修，原厂配件，假一赔十。",
      defaultPaperSize: "A4",
      version: 1,
      updatedAt: nowStr,
      updatedBy: { id: "u-owner", displayName: "白老板" },
    },
    backupPolicy: {
      enabled: true,
      backupTime: "02:00",
      retentionCount: 30,
      secondaryCopyEnabled: false,
      secondaryDirectory: "/var/backups/yc-erp",
      version: 1,
      nextRunAt: "2026-09-03T02:00:00.000Z",
      lastAttemptAt: "2026-09-02T02:00:00.000Z",
      lastSuccessAt: "2026-09-02T02:00:00.000Z",
      lastFailureAt: null,
      lastFailureMessage: null,
      lastSecondaryCopyAt: null,
      lastSecondaryCopyFailureAt: null,
      lastSecondaryCopyFailureMessage: null,
      updatedAt: nowStr,
      updatedBy: { id: "u-owner", displayName: "白老板" },
    },
    backups: [
      {
        id: "bk-20260902",
        fileName: "yc_erp_auto_20260902_020000.dump",
        createdAt: "2026-09-02T02:00:00.000Z",
        createdBy: null,
        kind: "AUTOMATIC",
        format: "PG_CUSTOM",
        sizeBytes: 1542890,
        sha256:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        entryCount: 1420,
        status: "VERIFIED",
        verifiedAt: "2026-09-02T02:00:05.000Z",
      },
    ],
  };
}

let state = createInitialState();

function parseBody(req: Connect.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    if (
      req.method === "GET" ||
      req.method === "HEAD" ||
      req.method === "OPTIONS"
    ) {
      return resolve({});
    }
    if ((req as any).body && typeof (req as any).body === "object") {
      return resolve((req as any).body);
    }
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
    setTimeout(() => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    }, 800);
  });
}

export function dispatchApi(
  method: string,
  rawUrl: string,
  body: any = {},
  headers: any = {},
): { status: number; data: any } {
  const [pathname] = rawUrl.split("?");
  const path =
    pathname.replace(
      /^(\/api\/v1|http:\/\/[^/]+\/api\/v1|https:\/\/[^/]+\/api\/v1)/,
      "",
    ) || "/";
  const searchParams = new URL(
    rawUrl.startsWith("http")
      ? rawUrl
      : `http://localhost${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`,
  ).searchParams;

  const sendJson = (status: number, data: any) => ({ status, data });

  try {
    // 1. Auth routes
    if (path === "/auth/bootstrap-status") {
      return sendJson(200, { required: false });
    }

    if (path === "/auth/register") {
      const username = String(body.username || "").trim();
      const displayName = String(body.displayName || username).trim();
      const role = String(body.role || "SALES")
        .trim()
        .toUpperCase();

      if (!username) {
        return sendJson(400, { message: "请输入登录账号" });
      }
      if (
        state.users.some(
          (u) => u.username.toLowerCase() === username.toLowerCase(),
        )
      ) {
        return sendJson(400, {
          message: `账号 “${username}” 已被注册，请换一个用户名或直接登录`,
        });
      }

      let roles = [role];
      let permissions = [
        "sales:*",
        "catalog:read",
        "parties:*",
        "inventory:read",
      ];
      if (role === "OWNER" || role === "MANAGER") {
        roles = [role];
        permissions = ["*"];
      } else if (role === "WAREHOUSE") {
        roles = ["WAREHOUSE"];
        permissions = ["inventory:*", "purchasing:*", "catalog:read"];
      } else if (role === "FINANCE") {
        roles = ["FINANCE"];
        permissions = [
          "finance:*",
          "payables:*",
          "receivables:*",
          "cash:*",
          "reports:*",
        ];
      } else if (role === "SALES") {
        roles = ["SALES"];
        permissions = [
          "sales:*",
          "catalog:read",
          "parties:*",
          "inventory:read",
        ];
      }

      const newUser = {
        id: "u-" + Date.now(),
        username,
        displayName: displayName || username,
        status: "ACTIVE" as const,
        roles,
        permissions,
        createdAt: new Date().toISOString(),
      };
      state.users.push(newUser);

      return sendJson(200, {
        accessToken: "mock-jwt-token-" + newUser.id + "-" + Date.now(),
        refreshToken: "mock-refresh-token-" + newUser.id + "-" + Date.now(),
        expiresIn: 86400,
        user: {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.displayName,
          roles: newUser.roles,
          permissions: newUser.permissions,
        },
      });
    }

    if (path === "/auth/bootstrap-owner" || path === "/auth/login") {
      const reqUsername = String(body.username || "").trim();
      const foundUser =
        state.users.find(
          (u) => u.username.toLowerCase() === reqUsername.toLowerCase(),
        ) || state.users[0];

      return sendJson(200, {
        accessToken: "mock-jwt-token-" + foundUser.id + "-" + Date.now(),
        refreshToken: "mock-refresh-token-" + foundUser.id + "-" + Date.now(),
        expiresIn: 86400,
        user: {
          id: foundUser.id,
          username: foundUser.username,
          displayName: foundUser.displayName,
          roles: foundUser.roles,
          permissions: foundUser.permissions,
        },
      });
    }

    if (path === "/auth/me") {
      let authHeader = "";
      if (headers) {
        if (typeof headers.get === "function") {
          authHeader =
            headers.get("authorization") || headers.get("Authorization") || "";
        } else if (typeof headers === "object") {
          authHeader =
            headers["authorization"] || headers["Authorization"] || "";
        }
      }
      // Extract userId if present in mock token
      const token =
        typeof authHeader === "string" ? authHeader.replace("Bearer ", "") : "";
      const matched = token.match(/mock-jwt-token-(u-[a-zA-Z0-9_-]+)/);
      const user =
        (matched && state.users.find((u) => u.id === matched[1])) ||
        state.users[0];
      return sendJson(200, {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roles: user.roles,
        permissions: user.permissions,
      });
    }

    if (path === "/auth/refresh") {
      return sendJson(200, {
        accessToken: "mock-jwt-token-refreshed",
        refreshToken: "mock-refresh-token-refreshed",
        expiresIn: 86400,
        user: state.users[0],
      });
    }

    if (path === "/auth/logout") {
      return sendJson(200, { success: true });
    }

    // 2. Identity / Users
    if (path === "/identity/users") {
      if (method === "GET") {
        return sendJson(200, { items: state.users });
      }
      if (method === "POST") {
        const newUser = {
          id: "u-" + Date.now(),
          username: body.username,
          displayName: body.displayName || body.username,
          status: "ACTIVE" as const,
          roles: body.roles || ["STAFF"],
          permissions: body.permissions || ["*"],
          createdAt: new Date().toISOString(),
        };
        state.users.push(newUser);
        return sendJson(201, newUser);
      }
    }

    if (path.startsWith("/identity/users/") && path.endsWith("/status")) {
      const userId = path.split("/")[3];
      const user = state.users.find((u) => u.id === userId);
      if (user) user.status = body.status;
      return sendJson(200, user);
    }

    if (path === "/identity/audit-logs") {
      return sendJson(200, {
        items: state.auditLogs,
        pagination: { page: 1, pageSize: 50, total: state.auditLogs.length },
      });
    }

    // 3. Catalog
    if (path === "/catalog/references") {
      return sendJson(200, {
        categories: state.categories,
        brands: state.brands,
        units: state.units,
      });
    }

    if (path === "/catalog/products") {
      if (method === "GET") {
        const search = (searchParams.get("search") || "").toLowerCase();
        const categoryId = searchParams.get("categoryId") || "";
        const status = searchParams.get("status") || "";

        let filtered = [...state.products];
        if (search) {
          filtered = filtered.filter(
            (p) =>
              p.name.toLowerCase().includes(search) ||
              p.code.toLowerCase().includes(search) ||
              (p.mnemonicCode && p.mnemonicCode.toLowerCase().includes(search)),
          );
        }
        if (categoryId) {
          filtered = filtered.filter((p) => p.category?.id === categoryId);
        }
        if (status) {
          filtered = filtered.filter((p) => p.status === status);
        }
        return sendJson(200, {
          items: filtered,
          page: 1,
          pageSize: 50,
          total: filtered.length,
        });
      }

      if (method === "POST") {
        const cat = state.categories.find((c) => c.id === body.categoryId) || {
          id: body.categoryId,
          code: "GENERAL",
          name: "通用分类",
        };
        const unit = state.units.find((u) => u.id === body.baseUnitId) || {
          id: body.baseUnitId,
          code: "PCS",
          name: "个",
          decimalScale: 0,
        };
        const brand = state.brands.find((b) => b.id === body.brandId) || null;

        const newProduct = {
          id: "p-" + Date.now(),
          code: body.code,
          name: body.name,
          mnemonicCode: body.mnemonicCode || null,
          type: body.type || "PART",
          model: body.model || null,
          specification: body.specification || null,
          category: cat,
          brand: brand,
          baseUnit: unit,
          retailPrice: body.retailPrice || "0.00",
          wholesalePrice: body.wholesalePrice || "0.00",
          defaultPurchasePrice: body.defaultPurchasePrice || "0.00",
          minimumSalePrice: body.minimumSalePrice || "0.00",
          safetyStock: body.safetyStock || "0",
          barcodes: body.barcodes || [],
          status: "ACTIVE",
          version: 1,
          attributes: {},
        };
        state.products.unshift(newProduct);
        return sendJson(201, newProduct);
      }
    }

    if (path.startsWith("/catalog/products/")) {
      const parts = path.split("/");
      const productId = parts[3];
      const isStatus = parts[4] === "status";

      const prodIndex = state.products.findIndex((p) => p.id === productId);
      if (prodIndex === -1) {
        return sendJson(404, { message: "商品不存在" });
      }

      if (isStatus) {
        state.products[prodIndex].status = body.status;
        state.products[prodIndex].version += 1;
        return sendJson(200, state.products[prodIndex]);
      }

      if (method === "PATCH") {
        const existing = state.products[prodIndex];
        const updated = {
          ...existing,
          ...body,
          version: existing.version + 1,
        };
        state.products[prodIndex] = updated;
        return sendJson(200, updated);
      }
    }

    // 4. Parties (Customers & Suppliers)
    if (path === "/parties") {
      if (method === "GET") {
        const search = (searchParams.get("search") || "").toLowerCase();
        const role = searchParams.get("role") || "";
        const status = searchParams.get("status") || "";

        let items = [...state.parties];
        if (search) {
          items = items.filter(
            (p) =>
              (p.name && p.name.toLowerCase().includes(search)) ||
              (p.code && p.code.toLowerCase().includes(search)) ||
              (p.shortName && p.shortName.toLowerCase().includes(search)) ||
              (p.phone && p.phone.includes(search)) ||
              (p.contacts &&
                p.contacts.some(
                  (c: any) =>
                    (c.name && c.name.toLowerCase().includes(search)) ||
                    (c.phone && c.phone.includes(search)),
                )) ||
              (p.contactPerson &&
                p.contactPerson.toLowerCase().includes(search)),
          );
        }
        if (role) {
          items = items.filter(
            (p) => (p.roles && p.roles.includes(role)) || p.role === role,
          );
        }
        if (status) items = items.filter((p) => p.status === status);

        return sendJson(200, {
          items,
          page: 1,
          pageSize: 100,
          total: items.length,
        });
      }

      if (method === "POST") {
        const primaryContactName =
          body.contacts?.[0]?.name || body.contactPerson || body.name;
        const primaryContactPhone =
          body.contacts?.[0]?.phone || body.phone || null;

        const newParty = {
          id: "pt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          code: body.code || `DW-${Date.now().toString().slice(-6)}`,
          name: body.name,
          shortName: body.shortName || null,
          role: body.roles?.[0] || body.role || "CUSTOMER",
          roles:
            body.roles && body.roles.length > 0
              ? body.roles
              : [body.role || "CUSTOMER"],
          taxId: body.taxId || null,
          identityNumberMasked: body.identityNumber
            ? body.identityNumber.slice(0, 6) +
              "********" +
              body.identityNumber.slice(-4)
            : null,
          hasPortrait: !!body.portraitDataUrl,
          creditLimit: String(body.creditLimit ?? "0.00"),
          paymentTermsDays: Number(body.paymentTermsDays ?? 0),
          paymentTermsMonths: Number(body.paymentTermsMonths ?? 0),
          province: body.province || null,
          city: body.city || null,
          address: body.address || null,
          notes: body.notes || null,
          phone: primaryContactPhone,
          contactPerson: primaryContactName,
          contacts:
            body.contacts && body.contacts.length > 0
              ? body.contacts.map((c: any, idx: number) => ({
                  id: c.id || `ct-${Date.now()}-${idx}`,
                  name: c.name || primaryContactName,
                  phone: c.phone || null,
                  email: c.email || null,
                  position: c.position || null,
                  isPrimary: c.isPrimary ?? idx === 0,
                }))
              : [
                  {
                    id: `ct-${Date.now()}-1`,
                    name: primaryContactName,
                    phone: primaryContactPhone,
                    email: body.email || null,
                    position: "主要联系人",
                    isPrimary: true,
                  },
                ],
          receivableBalance: "0.00",
          payableBalance: "0.00",
          status: "ACTIVE",
          version: 1,
        };
        state.parties.unshift(newParty);
        return sendJson(201, newParty);
      }
    }

    if (path === "/parties/batch") {
      if (method === "POST") {
        const list = Array.isArray(body.parties) ? body.parties : [];
        const created: any[] = [];
        for (const item of list) {
          const primaryContactName =
            item.contacts?.[0]?.name || item.contactPerson || item.name;
          const primaryContactPhone =
            item.contacts?.[0]?.phone || item.phone || null;

          const newP = {
            id:
              "pt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            code: item.code || `DW-${Date.now().toString().slice(-6)}`,
            name: item.name,
            shortName: item.shortName || null,
            role: item.roles?.[0] || item.role || "CUSTOMER",
            roles:
              item.roles && item.roles.length > 0
                ? item.roles
                : [item.role || "CUSTOMER"],
            taxId: item.taxId || null,
            identityNumberMasked: null,
            hasPortrait: false,
            creditLimit: String(item.creditLimit ?? "0.00"),
            paymentTermsDays: Number(item.paymentTermsDays ?? 0),
            paymentTermsMonths: Number(item.paymentTermsMonths ?? 0),
            province: item.province || null,
            city: item.city || null,
            address: item.address || null,
            notes: item.notes || null,
            phone: primaryContactPhone,
            contactPerson: primaryContactName,
            contacts:
              item.contacts && item.contacts.length > 0
                ? item.contacts.map((c: any, idx: number) => ({
                    id: c.id || `ct-${Date.now()}-${idx}`,
                    name: c.name || primaryContactName,
                    phone: c.phone || null,
                    email: c.email || null,
                    position: c.position || null,
                    isPrimary: c.isPrimary ?? idx === 0,
                  }))
                : [
                    {
                      id: `ct-${Date.now()}-1`,
                      name: primaryContactName,
                      phone: primaryContactPhone,
                      email: item.email || null,
                      position: "主要联系人",
                      isPrimary: true,
                    },
                  ],
            receivableBalance: "0.00",
            payableBalance: "0.00",
            status: "ACTIVE",
            version: 1,
          };
          state.parties.unshift(newP);
          created.push(newP);
        }
        return sendJson(200, { count: created.length, items: created });
      }
    }

    if (path.startsWith("/parties/")) {
      const partyId = path.split("/")[2];
      const party = state.parties.find((p) => p.id === partyId);
      if (!party) return sendJson(404, { message: "客户/供应商不存在" });

      if (path.endsWith("/status")) {
        party.status = body.status;
        party.version += 1;
        return sendJson(200, party);
      }

      if (method === "GET") return sendJson(200, party);
      if (method === "PATCH") {
        if (body.roles) {
          party.roles = body.roles;
          party.role = body.roles[0] || party.role;
        }
        if (body.contacts) {
          party.contacts = body.contacts;
          const primary =
            body.contacts.find((c: any) => c.isPrimary) || body.contacts[0];
          if (primary) {
            party.contactPerson = primary.name;
            party.phone = primary.phone;
          }
        }
        if (body.creditLimit !== undefined)
          party.creditLimit = String(body.creditLimit);
        if (body.paymentTermsDays !== undefined)
          party.paymentTermsDays = Number(body.paymentTermsDays);
        if (body.paymentTermsMonths !== undefined)
          party.paymentTermsMonths = Number(body.paymentTermsMonths);
        if (body.name !== undefined) party.name = body.name;
        if (body.code !== undefined) party.code = body.code;
        if (body.shortName !== undefined) party.shortName = body.shortName;
        if (body.taxId !== undefined) party.taxId = body.taxId;
        if (body.province !== undefined) party.province = body.province;
        if (body.city !== undefined) party.city = body.city;
        if (body.address !== undefined) party.address = body.address;
        if (body.notes !== undefined) party.notes = body.notes;
        party.version = (party.version || 1) + 1;
        return sendJson(200, party);
      }
    }

    // 5. Warehouses
    if (path === "/warehouses") {
      if (method === "GET") {
        return sendJson(200, {
          items: state.warehouses,
          page: 1,
          pageSize: 50,
          total: state.warehouses.length,
        });
      }
      if (method === "POST") {
        const newWh = {
          id: "wh-" + Date.now(),
          code: body.code,
          name: body.name,
          address: body.address || "",
          isDefault: body.isDefault ?? false,
          status: "ACTIVE",
          version: 1,
          locations: body.locations || [],
        };
        if (newWh.isDefault) {
          state.warehouses.forEach((w) => (w.isDefault = false));
        }
        state.warehouses.push(newWh);
        return sendJson(201, newWh);
      }
    }

    if (path.startsWith("/warehouses/")) {
      const whId = path.split("/")[2];
      const wh = state.warehouses.find((w) => w.id === whId);
      if (!wh) return sendJson(404, { message: "仓库不存在" });

      if (path.endsWith("/set-default")) {
        state.warehouses.forEach((w) =>
          w.id === whId ? (w.isDefault = true) : (w.isDefault = false),
        );
        return sendJson(200, wh);
      }
      if (path.endsWith("/status")) {
        wh.status = body.status;
        return sendJson(200, wh);
      }
      if (method === "PATCH") {
        Object.assign(wh, body, { version: (wh.version || 1) + 1 });
        return sendJson(200, wh);
      }
    }

    // 6. Sales Documents
    if (path === "/sales/documents") {
      if (method === "GET") {
        return sendJson(200, { items: state.salesDocuments });
      }
      if (method === "POST") {
        const customer = state.parties.find(
          (p) => p.id === body.customerId,
        ) || {
          id: body.customerId,
          code: "KH-GEN",
          name: "零售客户",
          phone: "13800000000",
        };
        const warehouse =
          state.warehouses.find((w) => w.id === body.warehouseId) ||
          state.warehouses[0];
        const cashAccount = body.cashAccountId
          ? state.cashAccounts.find((c) => c.id === body.cashAccountId)
          : null;

        const lines = (body.lines || []).map((l: any, i: number) => {
          const product = state.products.find((p) => p.id === l.productId) || {
            id: l.productId,
            code: "P-GEN",
            name: "商品",
          };
          const qty = Number(l.quantity || 1);
          const price = Number(l.unitPrice || 0);
          const cost = Number(l.unitCost || product.defaultPurchasePrice || 0);
          const amount = qty * price;
          const costAmount = qty * cost;
          return {
            id: "sdl-" + Date.now() + "-" + i,
            product,
            quantity: String(qty),
            unitPrice: price.toFixed(2),
            lineAmount: amount.toFixed(2),
            unitCost: cost.toFixed(2),
            costAmount: costAmount.toFixed(2),
            grossProfit: (amount - costAmount).toFixed(2),
            unitNameSnapshot: product.baseUnit?.name || "个",
          };
        });

        const totalAmount = lines
          .reduce((sum: number, l: any) => sum + Number(l.lineAmount), 0)
          .toFixed(2);
        const totalCost = lines
          .reduce((sum: number, l: any) => sum + Number(l.costAmount), 0)
          .toFixed(2);
        const grossProfit = (Number(totalAmount) - Number(totalCost)).toFixed(
          2,
        );

        const docNumber = `XS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(state.salesDocuments.length + 1).padStart(4, "0")}`;

        const doc = {
          id: "sd-" + Date.now(),
          documentNumber: docNumber,
          status: "DRAFT",
          settlementType: body.settlementType || "IMMEDIATE",
          businessDate:
            body.businessDate || new Date().toISOString().slice(0, 10),
          soldAt: new Date().toISOString(),
          dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
          totalAmount,
          totalCost,
          grossProfit,
          version: 1,
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone,
          customer,
          warehouse,
          cashAccount,
          postedBy: { id: "u-owner", displayName: "白老板" },
          receivableEntry:
            body.settlementType === "CREDIT"
              ? {
                  id: "rec-" + Date.now(),
                  outstandingAmount: totalAmount,
                  status: "OPEN",
                }
              : null,
          reversal: null,
          lines,
        };

        state.salesDocuments.unshift(doc);
        return sendJson(201, doc);
      }
    }

    if (path.startsWith("/sales/documents/")) {
      const parts = path.split("/");
      const docId = parts[3];
      const action = parts[4];
      const doc = state.salesDocuments.find((d) => d.id === docId);

      if (!doc) return sendJson(404, { message: "销售单不存在" });

      if (action === "submit") {
        doc.status = "SUBMITTED";
        doc.version += 1;
        return sendJson(200, doc);
      }

      if (action === "post") {
        doc.status = "POSTED";
        doc.version += 1;
        // Update inventory ledger
        doc.lines.forEach((line: any) => {
          state.inventoryLedger.unshift({
            id: "leg-" + Date.now() + "-" + line.id,
            sourceDocumentId: doc.id,
            sourceDocumentType:
              doc.settlementType === "IMMEDIATE"
                ? "CASH_SALE"
                : "SALES_DISPATCH",
            sourceDocumentNumber: doc.documentNumber,
            product: line.product,
            warehouse: doc.warehouse,
            location: null,
            quantityChange: `-${line.quantity}`,
            unitCost: line.unitCost,
            costAmount: `-${line.costAmount}`,
            businessDate: doc.businessDate,
            postedAt: new Date().toISOString(),
            postedBy: { id: "u-owner", displayName: "白老板" },
          });
        });
        return sendJson(200, doc);
      }

      if (action === "reverse") {
        doc.status = "REVERSED";
        doc.reversal = {
          id: "rev-" + Date.now(),
          documentNumber: `CX-${doc.documentNumber}`,
          reason: body.reason || "客户退货冲正",
          reversedAt: new Date().toISOString(),
          postedBy: { id: "u-owner", displayName: "白老板" },
        };
        return sendJson(200, doc.reversal);
      }

      if (method === "GET") return sendJson(200, doc);
    }

    if (path === "/sales/receivables") {
      return sendJson(200, { items: state.receivablesEntries });
    }

    if (path === "/sales/returns") {
      if (method === "GET") {
        const total = (state.salesReturns || []).reduce(
          (sum: number, item: any) => sum + Number(item.totalAmount || 0),
          0,
        );
        return sendJson(200, {
          items: state.salesReturns || [],
          summary: { totalAmount: total.toFixed(2) },
        });
      }
      if (method === "POST") {
        const ret = {
          id: "sr-" + Date.now(),
          documentNumber: `TH-${Date.now().toString().slice(-6)}`,
          status: "POSTED",
          ...body,
          returnedAt: new Date().toISOString(),
        };
        state.salesReturns.unshift(ret);
        return sendJson(201, ret);
      }
    }

    if (path === "/purchasing/returns") {
      if (method === "GET") {
        const items = state.purchasingReturns || [];
        const total = items.reduce(
          (sum: number, item: any) => sum + Number(item.totalAmount || 0),
          0,
        );
        const payableRed = items.reduce(
          (sum: number, item: any) => sum + Number(item.payableReduction || 0),
          0,
        );
        const refundAmt = items.reduce(
          (sum: number, item: any) => sum + Number(item.refundAmount || 0),
          0,
        );
        return sendJson(200, {
          items,
          summary: {
            totalAmount: total.toFixed(2),
            payableReduction: payableRed.toFixed(2),
            refundAmount: refundAmt.toFixed(2),
          },
        });
      }
      if (method === "POST") {
        const ret = {
          id: "pr-ret-" + Date.now(),
          documentNumber: `CGTH-${Date.now().toString().slice(-6)}`,
          status: "POSTED",
          ...body,
          returnedAt: new Date().toISOString(),
        };
        if (!state.purchasingReturns) state.purchasingReturns = [];
        state.purchasingReturns.unshift(ret);
        return sendJson(201, ret);
      }
    }

    // 7. Purchasing Receipts
    if (path === "/purchasing/receipts") {
      if (method === "GET") {
        return sendJson(200, { items: state.purchasingReceipts });
      }
      if (method === "POST") {
        const supplier = state.parties.find(
          (p) => p.id === body.supplierId,
        ) || {
          id: body.supplierId,
          code: "GYS-GEN",
          name: "供应商",
        };
        const warehouse =
          state.warehouses.find((w) => w.id === body.warehouseId) ||
          state.warehouses[0];

        const docNumber = `CG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(state.purchasingReceipts.length + 1).padStart(4, "0")}`;

        const formattedLines = (body.lines || []).map((l: any, idx: number) => {
          const prod = state.products.find((p) => p.id === l.productId) || {
            id: l.productId,
            code: "PJ-GEN",
            name: "配件",
            baseUnit: { name: "个" },
          };
          const unitPrice = l.unitPrice || prod.defaultPurchasePrice || "0.00";
          const qty = l.quantity || "1";
          const lineAmount = (Number(qty) * Number(unitPrice)).toFixed(2);
          return {
            id: `pr-line-${Date.now()}-${idx}`,
            product: { id: prod.id, code: prod.code, name: prod.name },
            quantity: qty,
            unitPrice: String(unitPrice),
            lineAmount,
            unitNameSnapshot: prod.baseUnit?.name || "个",
          };
        });

        const receiptTotal = formattedLines
          .reduce((sum: number, l: any) => sum + Number(l.lineAmount), 0)
          .toFixed(2);

        const receipt = {
          id: "pr-" + Date.now(),
          documentNumber: docNumber,
          status: "POSTED",
          businessDate:
            body.businessDate || new Date().toISOString().slice(0, 10),
          receivedAt: new Date().toISOString(),
          totalAmount: body.totalAmount || receiptTotal,
          notes: body.notes || "",
          version: 1,
          supplier,
          warehouse,
          lines: formattedLines,
          postedBy: { id: "u-owner", displayName: "白老板" },
          postedAt: new Date().toISOString(),
        };

        // Update balances and ledger upon purchasing receipt
        formattedLines.forEach((line: any) => {
          const qty = Number(line.quantity);
          const unitCost = Number(line.unitPrice);
          const costAmount = qty * unitCost;
          const balance = state.inventoryBalances.find(
            (b) =>
              b.warehouse.id === warehouse.id &&
              b.product.id === line.product.id,
          );
          if (balance) {
            const currentQty = Number(balance.quantity);
            const currentCost = Number(balance.totalCost);
            const newQty = currentQty + qty;
            const newCost = currentCost + costAmount;
            balance.quantity = String(newQty);
            balance.totalCost = newCost.toFixed(2);
            balance.averageCost =
              newQty > 0 ? (newCost / newQty).toFixed(2) : balance.averageCost;
            balance.version += 1;
            balance.updatedAt = new Date().toISOString();
          } else {
            state.inventoryBalances.push({
              id: "bal-" + Date.now() + "-" + line.product.id,
              product: {
                id: line.product.id,
                code: line.product.code,
                name: line.product.name,
                categoryName: "配件",
                unitName: line.unitNameSnapshot,
                safetyStock: "10",
              },
              warehouse,
              quantity: String(qty),
              totalCost: costAmount.toFixed(2),
              averageCost: unitCost.toFixed(2),
              version: 1,
              updatedAt: new Date().toISOString(),
            });
          }

          state.inventoryLedger.unshift({
            id: "leg-" + Date.now() + "-pr-" + line.id,
            sourceDocumentId: receipt.id,
            sourceDocumentType: "PURCHASE_RECEIPT",
            sourceDocumentNumber: receipt.documentNumber,
            product: line.product,
            warehouse,
            location: null,
            quantityChange: `+${qty}`,
            unitCost: line.unitPrice,
            costAmount: `+${costAmount.toFixed(2)}`,
            businessDate: receipt.businessDate,
            postedAt: new Date().toISOString(),
            postedBy: { id: "u-owner", displayName: "白老板" },
          });
        });

        state.purchasingReceipts.unshift(receipt);
        return sendJson(201, receipt);
      }
    }

    // 8. Inventory & Stocktakes & Ledger
    if (path === "/inventory/balances") {
      return sendJson(200, { items: state.inventoryBalances });
    }

    if (path === "/inventory/ledger") {
      return sendJson(200, {
        items: state.inventoryLedger,
        pagination: {
          page: 1,
          pageSize: 20,
          total: state.inventoryLedger.length,
          totalPages: 1,
        },
      });
    }

    if (path === "/inventory/opening-documents") {
      if (method === "GET") {
        return sendJson(200, { items: state.openingDocuments });
      }
      if (method === "POST") {
        const doc = {
          id: "op-" + Date.now(),
          documentNumber: `QC-${Date.now().toString().slice(-6)}`,
          status: "POSTED",
          businessDate:
            body.businessDate || new Date().toISOString().slice(0, 10),
          notes: body.notes || "",
          version: 1,
          warehouse: state.warehouses[0],
          createdBy: { id: "u-owner", displayName: "白老板" },
          postedBy: { id: "u-owner", displayName: "白老板" },
          postedAt: new Date().toISOString(),
          lines: body.lines || [],
        };
        state.openingDocuments.unshift(doc);
        return sendJson(201, doc);
      }
    }

    if (path === "/inventory/stocktakes") {
      if (method === "GET") {
        return sendJson(200, { items: state.stocktakes });
      }
      if (method === "POST") {
        const st = {
          id: "st-" + Date.now(),
          documentNumber: `PD-${Date.now().toString().slice(-6)}`,
          status: "DRAFT",
          businessDate:
            body.businessDate || new Date().toISOString().slice(0, 10),
          notes: body.notes || "",
          version: 1,
          warehouse:
            state.warehouses.find((w) => w.id === body.warehouseId) ||
            state.warehouses[0],
          createdBy: { id: "u-owner", displayName: "白老板" },
          submittedBy: null,
          postedBy: null,
          submittedAt: null,
          postedAt: null,
          progress: {
            counted: 0,
            total: state.products.length,
          },
          varianceCount: 0,
          lines: state.products.map((p) => ({
            id: "stl-" + p.id,
            product: p,
            productNameSnapshot: p.name,
            unitNameSnapshot: p.baseUnit?.name || "个",
            baselineQuantity: "10",
            baselineTotalCost: "1000.00",
            baselineAverageCost: "100.00",
            countedQuantity: null,
            varianceQuantity: null,
            reason: null,
          })),
        };
        state.stocktakes.unshift(st);
        return sendJson(201, st);
      }
    }

    if (path.startsWith("/inventory/stocktakes/")) {
      const stId = path.split("/")[3];
      const st = state.stocktakes.find((s) => s.id === stId);
      if (!st) return sendJson(404, { message: "盘点单不存在" });

      if (path.endsWith("/counts")) {
        st.lines = (body.lines || []).map((l: any) => ({
          ...st.lines.find((x: any) => x.id === l.lineId),
          countedQuantity: l.countedQuantity,
          reason: l.reason,
        }));
        st.progress.counted = st.lines.filter(
          (l: any) => l.countedQuantity !== null,
        ).length;
        st.version += 1;
        return sendJson(200, st);
      }
      if (path.endsWith("/submit")) {
        st.status = "SUBMITTED";
        st.submittedBy = { id: "u-owner", displayName: "白老板" };
        st.submittedAt = new Date().toISOString();
        return sendJson(200, st);
      }
      if (path.endsWith("/post")) {
        st.status = "POSTED";
        st.postedBy = { id: "u-owner", displayName: "白老板" };
        st.postedAt = new Date().toISOString();
        return sendJson(200, st);
      }
    }

    if (path === "/inventory/damages") {
      if (method === "GET") return sendJson(200, { items: state.damages });
      if (method === "POST") {
        const doc = {
          id: "dmg-" + Date.now(),
          documentNumber: `BS-${Date.now().toString().slice(-6)}`,
          status: "DRAFT",
          businessDate: body.businessDate,
          notes: body.notes || "",
          version: 1,
          totalCost: "0.00",
          warehouse: state.warehouses[0],
          createdBy: { id: "u-owner", displayName: "白老板" },
          submittedBy: null,
          postedBy: null,
          submittedAt: null,
          postedAt: null,
          lines: body.lines || [],
        };
        state.damages.unshift(doc);
        return sendJson(201, doc);
      }
    }

    if (path === "/inventory/transfers") {
      if (method === "GET") return sendJson(200, { items: state.transfers });
      if (method === "POST") {
        const sourceWarehouse =
          state.warehouses.find((w) => w.id === body.sourceWarehouseId) ||
          state.warehouses[0];
        const targetWarehouse =
          state.warehouses.find((w) => w.id === body.targetWarehouseId) ||
          state.warehouses[1] ||
          state.warehouses[0];

        const lines = (body.lines || []).map((l: any, i: number) => {
          const product = state.products.find((p) => p.id === l.productId) || {
            id: l.productId,
            code: "P-GEN",
            name: "商品",
          };
          const sourceBalance = state.inventoryBalances.find(
            (b) =>
              b.product.id === l.productId &&
              b.warehouse.id === sourceWarehouse.id,
          );
          const qty = Number(l.quantity || 1);
          const unitCost = Number(
            l.unitCost ||
              sourceBalance?.averageCost ||
              product.defaultPurchasePrice ||
              "0.00",
          );
          const lineAmount = (qty * unitCost).toFixed(2);
          return {
            id: "trl-" + Date.now() + "-" + i,
            product,
            productNameSnapshot: product.name,
            unitNameSnapshot:
              product.baseUnit?.name || product.unitName || "个",
            quantity: String(qty),
            unitCost: unitCost.toFixed(2),
            lineAmount,
          };
        });

        const totalAmount = lines
          .reduce((sum: number, line: any) => sum + Number(line.lineAmount), 0)
          .toFixed(2);

        const doc = {
          id: "tr-" + Date.now(),
          documentNumber: `DB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(state.transfers.length + 1).padStart(4, "0")}`,
          status: "DRAFT",
          businessDate:
            body.businessDate || new Date().toISOString().slice(0, 10),
          notes: body.notes || "",
          version: 1,
          totalAmount,
          sourceWarehouse,
          targetWarehouse,
          createdBy: { id: "u-owner", displayName: "白老板" },
          submittedBy: null,
          postedBy: null,
          submittedAt: null,
          postedAt: null,
          lines,
        };
        state.transfers.unshift(doc);
        return sendJson(201, doc);
      }
    }

    if (path.startsWith("/inventory/transfers/")) {
      const trId = path.split("/")[3];
      const doc = state.transfers.find((t) => t.id === trId);
      if (!doc) return sendJson(404, { message: "调拨单不存在" });

      if (method === "GET") return sendJson(200, doc);

      if (method === "PATCH") {
        if (body.sourceWarehouseId) {
          doc.sourceWarehouse =
            state.warehouses.find((w) => w.id === body.sourceWarehouseId) ||
            doc.sourceWarehouse;
        }
        if (body.targetWarehouseId) {
          doc.targetWarehouse =
            state.warehouses.find((w) => w.id === body.targetWarehouseId) ||
            doc.targetWarehouse;
        }
        if (body.businessDate) doc.businessDate = body.businessDate;
        if (body.notes !== undefined) doc.notes = body.notes;
        if (body.lines) {
          doc.lines = body.lines.map((l: any, i: number) => {
            const product = state.products.find(
              (p) => p.id === l.productId,
            ) || {
              id: l.productId,
              code: "P-GEN",
              name: "商品",
            };
            const sourceBalance = state.inventoryBalances.find(
              (b) =>
                b.product.id === l.productId &&
                b.warehouse.id === doc.sourceWarehouse.id,
            );
            const qty = Number(l.quantity || 1);
            const unitCost = Number(
              l.unitCost ||
                sourceBalance?.averageCost ||
                product.defaultPurchasePrice ||
                "0.00",
            );
            const lineAmount = (qty * unitCost).toFixed(2);
            return {
              id: "trl-" + Date.now() + "-" + i,
              product,
              productNameSnapshot: product.name,
              unitNameSnapshot:
                product.baseUnit?.name || product.unitName || "个",
              quantity: String(qty),
              unitCost: unitCost.toFixed(2),
              lineAmount,
            };
          });
          doc.totalAmount = doc.lines
            .reduce(
              (sum: number, line: any) => sum + Number(line.lineAmount),
              0,
            )
            .toFixed(2);
        }
        doc.version += 1;
        return sendJson(200, doc);
      }

      if (path.endsWith("/submit")) {
        doc.status = "SUBMITTED";
        doc.submittedBy = { id: "u-owner", displayName: "白老板" };
        doc.submittedAt = new Date().toISOString();
        return sendJson(200, doc);
      }

      if (path.endsWith("/post")) {
        doc.status = "POSTED";
        doc.postedBy = { id: "u-owner", displayName: "白老板" };
        doc.postedAt = new Date().toISOString();

        // Perform multi-warehouse balance update and ledger records
        (doc.lines || []).forEach((line: any) => {
          const qty = Number(line.quantity || 0);
          const unitCost = Number(line.unitCost || 0);
          const costAmount = Number(line.lineAmount || qty * unitCost);

          // 1. Source warehouse balance decrease
          const sourceBalance = state.inventoryBalances.find(
            (b) =>
              b.product.id === line.product.id &&
              b.warehouse.id === doc.sourceWarehouse.id,
          );
          if (sourceBalance) {
            const newQty = Math.max(0, Number(sourceBalance.quantity) - qty);
            const newCost = Math.max(
              0,
              Number(sourceBalance.totalCost) - costAmount,
            );
            sourceBalance.quantity = String(newQty);
            sourceBalance.totalCost = newCost.toFixed(2);
            sourceBalance.updatedAt = new Date().toISOString();
          }

          // 2. Target warehouse balance increase
          let targetBalance = state.inventoryBalances.find(
            (b) =>
              b.product.id === line.product.id &&
              b.warehouse.id === doc.targetWarehouse.id,
          );
          if (targetBalance) {
            const newQty = Number(targetBalance.quantity) + qty;
            const newCost = Number(targetBalance.totalCost) + costAmount;
            targetBalance.quantity = String(newQty);
            targetBalance.totalCost = newCost.toFixed(2);
            targetBalance.averageCost =
              newQty > 0
                ? (newCost / newQty).toFixed(2)
                : targetBalance.averageCost;
            targetBalance.updatedAt = new Date().toISOString();
          } else {
            targetBalance = {
              id:
                "ib-" +
                Date.now() +
                "-" +
                Math.random().toString(36).slice(2, 6),
              product: {
                id: line.product.id,
                code: line.product.code,
                name: line.product.name,
                categoryName: line.product.category?.name || "配件",
                unitName: line.unitNameSnapshot || "个",
                safetyStock: line.product.safetyStock || "10",
              },
              warehouse: doc.targetWarehouse,
              quantity: String(qty),
              totalCost: costAmount.toFixed(2),
              averageCost: unitCost.toFixed(2),
              version: 1,
              updatedAt: new Date().toISOString(),
            };
            state.inventoryBalances.push(targetBalance);
          }

          // 3. Ledger records: OUT from source, IN to target
          state.inventoryLedger.unshift({
            id:
              "leg-" +
              Date.now() +
              "-out-" +
              Math.random().toString(36).slice(2, 6),
            sourceDocumentId: doc.id,
            sourceDocumentType: "TRANSFER_OUT",
            sourceDocumentNumber: doc.documentNumber,
            product: line.product,
            warehouse: doc.sourceWarehouse,
            location: null,
            quantityChange: `-${qty}`,
            unitCost: line.unitCost,
            costAmount: `-${costAmount.toFixed(2)}`,
            businessDate: doc.businessDate,
            postedAt: new Date().toISOString(),
            postedBy: { id: "u-owner", displayName: "白老板" },
          });

          state.inventoryLedger.unshift({
            id:
              "leg-" +
              Date.now() +
              "-in-" +
              Math.random().toString(36).slice(2, 6),
            sourceDocumentId: doc.id,
            sourceDocumentType: "TRANSFER_IN",
            sourceDocumentNumber: doc.documentNumber,
            product: line.product,
            warehouse: doc.targetWarehouse,
            location: null,
            quantityChange: `+${qty}`,
            unitCost: line.unitCost,
            costAmount: `+${costAmount.toFixed(2)}`,
            businessDate: doc.businessDate,
            postedAt: new Date().toISOString(),
            postedBy: { id: "u-owner", displayName: "白老板" },
          });
        });

        return sendJson(200, doc);
      }
    }

    // 9. Payables & Receivables
    if (path === "/payables/overview") {
      return sendJson(200, {
        totalPayable: "73400.00",
        supplierCount: 2,
        overduePayable: "0.00",
        overdueCount: 0,
      });
    }

    if (path === "/payables/entries") {
      const supplierId = searchParams.get("supplierId") || "";
      let items = state.payablesEntries;
      if (supplierId)
        items = items.filter((e) => e.supplier?.id === supplierId);
      return sendJson(200, { items });
    }

    if (path === "/payables/payments") {
      if (method === "GET")
        return sendJson(200, { items: state.payablesPayments });
      if (method === "POST") {
        const payment = {
          id: "pay-" + Date.now(),
          documentNumber: `FK-${Date.now().toString().slice(-6)}`,
          ...body,
          paidAt: new Date().toISOString(),
        };
        state.payablesPayments.unshift(payment);
        return sendJson(201, payment);
      }
    }

    if (path === "/payables/advances") {
      if (method === "GET") {
        return sendJson(200, {
          items: state.payablesAdvances,
          summary: { originalAmount: "0.00", availableAmount: "0.00" },
        });
      }
      if (method === "POST") {
        const adv = {
          id: "padv-" + Date.now(),
          documentNumber: `YF-${Date.now().toString().slice(-6)}`,
          ...body,
          paidAt: new Date().toISOString(),
        };
        state.payablesAdvances.unshift(adv);
        return sendJson(201, adv);
      }
    }

    if (path.startsWith("/payables/statements/")) {
      const supplierId = path.split("/")[3];
      const supplier = state.parties.find((p) => p.id === supplierId) || {
        id: supplierId,
        code: "GYS-0001",
        name: "供应商",
        phone: "13800000000",
        contactName: "张经理",
        address: "安徽省玉春县",
      };
      return sendJson(200, {
        supplier,
        period: {
          dateFrom: searchParams.get("dateFrom") || "2026-08-01",
          dateTo: searchParams.get("dateTo") || "2026-09-02",
        },
        summary: {
          openingBalance: "30000.00",
          increases: "43400.00",
          decreases: "0.00",
          closingBalance: "73400.00",
        },
        items: [
          {
            id: "st-item-1",
            businessDate: "2026-08-15",
            kind: "CREDIT_PURCHASE",
            label: "采购挂账入库",
            documentNumber: "CG-20260815-0003",
            sourceDocumentNumber: null,
            increase: "45000.00",
            decrease: "0.00",
            balance: "45000.00",
            note: "东方红配件采购",
          },
        ],
        generatedAt: new Date().toISOString(),
      });
    }

    if (path === "/payables/cash-accounts") {
      if (method === "GET") return sendJson(200, { items: state.cashAccounts });
      if (method === "POST") {
        const ca = {
          id: "ca-" + Date.now(),
          code: body.code,
          name: body.name,
          type: body.type,
          balance: body.openingBalance || "0.00",
          isDefault: false,
        };
        state.cashAccounts.push(ca);
        return sendJson(201, ca);
      }
    }

    if (path === "/receivables/overview") {
      return sendJson(200, {
        totalReceivable: "40770.00",
        customerCount: 3,
        overdueReceivable: "18600.00",
        overdueCount: 1,
      });
    }

    if (path === "/receivables/entries") {
      const customerId = searchParams.get("customerId") || "";
      let items = state.receivablesEntries;
      if (customerId)
        items = items.filter((e) => e.customer?.id === customerId);
      return sendJson(200, { items });
    }

    if (path === "/receivables/receipts") {
      if (method === "GET")
        return sendJson(200, { items: state.receivablesReceipts });
      if (method === "POST") {
        const receipt = {
          id: "sk-" + Date.now(),
          documentNumber: `SK-${Date.now().toString().slice(-6)}`,
          businessDate:
            body.businessDate || new Date().toISOString().slice(0, 10),
          amount: body.amount || "0.00",
          postedAt: new Date().toISOString(),
          notes: body.notes || "",
          customer: state.parties.find((p) => p.id === body.customerId) || {
            id: body.customerId,
            name: "客户",
          },
          cashAccount:
            state.cashAccounts.find((c) => c.id === body.cashAccountId) ||
            state.cashAccounts[0],
          postedBy: { id: "u-owner", displayName: "白老板" },
          allocations: body.allocations || [],
          reversal: null,
        };
        state.receivablesReceipts.unshift(receipt);
        return sendJson(201, receipt);
      }
    }

    if (path === "/receivables/advances") {
      if (method === "GET") {
        return sendJson(200, {
          items: state.receivablesAdvances,
          summary: { originalAmount: "0.00", availableAmount: "0.00" },
        });
      }
      if (method === "POST") {
        const adv = {
          id: "radv-" + Date.now(),
          documentNumber: `YS-${Date.now().toString().slice(-6)}`,
          ...body,
          receivedAt: new Date().toISOString(),
        };
        state.receivablesAdvances.unshift(adv);
        return sendJson(201, adv);
      }
    }

    if (path.startsWith("/receivables/statements/")) {
      const customerId = path.split("/")[3];
      const customer = state.parties.find((p) => p.id === customerId) || {
        id: customerId,
        code: "KH-0001",
        name: "客户",
        phone: "13856232268",
        contactName: "李明",
        address: "玉春县向阳镇",
      };
      return sendJson(200, {
        customer,
        period: {
          dateFrom: searchParams.get("dateFrom") || "2026-08-01",
          dateTo: searchParams.get("dateTo") || "2026-09-02",
        },
        summary: {
          openingBalance: "0.00",
          increases: "18600.00",
          decreases: "0.00",
          closingBalance: "18600.00",
        },
        items: [
          {
            id: "st-c-1",
            businessDate: "2026-08-20",
            kind: "CREDIT_SALE",
            label: "赊销出库",
            documentNumber: "XS-20260820-0008",
            sourceDocumentNumber: null,
            increase: "18600.00",
            decrease: "0.00",
            balance: "18600.00",
            note: "拖拉机配件及机油",
          },
        ],
        generatedAt: new Date().toISOString(),
      });
    }

    // 10. Dashboard reporting
    if (
      path.startsWith("/reporting/dashboard") ||
      path.startsWith("/dashboard/overview")
    ) {
      const period = searchParams.get("period") || "TODAY";
      return sendJson(200, {
        period,
        periodStart: "2026-09-01T00:00:00.000Z",
        periodEndExclusive: "2026-09-02T00:00:00.000Z",
        timezone: "Asia/Shanghai",
        generatedAt: new Date().toISOString(),
        sales: {
          gross: "18640.00",
          returns: "0.00",
          reversals: "0.00",
          net: "18640.00",
          grossProfit: "6240.00",
          postedCount: 1,
          returnCount: 0,
          reversalCount: 0,
        },
        receivables: {
          outstanding: "40770.00",
          count: 3,
          overdueAmount: "18600.00",
          overdueCount: 1,
        },
        payables: {
          outstanding: "73400.00",
          count: 2,
          overdueAmount: "0.00",
          overdueCount: 0,
        },
        inventory: {
          lowStockProductCount: 1,
          negativeStockProductCount: 0,
          items: [
            {
              id: "p-lx-0708",
              code: "PJ-LX-0708",
              name: "柴油精滤滤芯 CX0708",
              unitName: "个",
              quantity: "24",
              safetyStock: "40",
            },
          ],
        },
        cash: {
          balance: "378870.00",
          accountCount: 4,
        },
        overdueCustomers: [
          {
            id: "rec-1",
            customerId: "pt-lm",
            customerName: "李明家庭农场",
            phone: "13856232268",
            documentNumber: "XS-20260820-0008",
            outstandingAmount: "18600.00",
            dueDate: "2026-08-30",
            overdueDays: 3,
          },
        ],
        recentSales: [
          {
            id: "sd-1",
            documentNumber: "XS-20260901-0001",
            status: "POSTED",
            settlementType: "IMMEDIATE",
            customerNameSnapshot: "王建国农机作业队",
            totalAmount: "18640.00",
            soldAt: new Date().toISOString(),
          },
        ],
        trend: [
          {
            date: "2026-08-27",
            salesGross: "12400.00",
            salesReturns: "0.00",
            salesReversals: "0.00",
            salesNet: "12400.00",
          },
          {
            date: "2026-08-28",
            salesGross: "15800.00",
            salesReturns: "0.00",
            salesReversals: "0.00",
            salesNet: "15800.00",
          },
          {
            date: "2026-08-29",
            salesGross: "9200.00",
            salesReturns: "0.00",
            salesReversals: "0.00",
            salesNet: "9200.00",
          },
          {
            date: "2026-08-30",
            salesGross: "21500.00",
            salesReturns: "0.00",
            salesReversals: "0.00",
            salesNet: "21500.00",
          },
          {
            date: "2026-08-31",
            salesGross: "14600.00",
            salesReturns: "0.00",
            salesReversals: "0.00",
            salesNet: "14600.00",
          },
          {
            date: "2026-09-01",
            salesGross: "18640.00",
            salesReturns: "0.00",
            salesReversals: "0.00",
            salesNet: "18640.00",
          },
        ],
      });
    }

    // 11. Cash Transfers
    if (path === "/cash/transfers") {
      if (method === "GET")
        return sendJson(200, { items: state.cashTransfers });
      if (method === "POST") {
        const transfer = {
          id: "ct-" + Date.now(),
          documentNumber: `DB-${Date.now().toString().slice(-6)}`,
          ...body,
          transferredAt: new Date().toISOString(),
        };
        state.cashTransfers.unshift(transfer);
        return sendJson(201, transfer);
      }
    }

    // 12. Administration
    if (path === "/administration/business-profile") {
      if (method === "GET") return sendJson(200, state.businessProfile);
      if (method === "PATCH") {
        state.businessProfile = {
          ...state.businessProfile,
          ...body,
          version: state.businessProfile.version + 1,
          updatedAt: new Date().toISOString(),
        };
        return sendJson(200, state.businessProfile);
      }
    }

    if (path === "/administration/backups") {
      if (method === "GET") {
        return sendJson(200, {
          items: state.backups,
          operation: null,
          restoreConfirmationHint: "RESTORE",
        });
      }
      if (method === "POST") {
        const newBk = {
          id: "bk-" + Date.now(),
          fileName: `yc_erp_manual_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.dump`,
          createdAt: new Date().toISOString(),
          createdBy: { id: "u-owner", displayName: "白老板" },
          kind: "MANUAL",
          format: "PG_CUSTOM",
          sizeBytes: 1620000,
          sha256:
            "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
          entryCount: 1540,
          status: "VERIFIED",
          verifiedAt: new Date().toISOString(),
        };
        state.backups.unshift(newBk);
        return sendJson(201, newBk);
      }
    }

    if (path === "/administration/backups/policy") {
      if (method === "GET") return sendJson(200, state.backupPolicy);
      if (method === "PATCH") {
        state.backupPolicy = {
          ...state.backupPolicy,
          ...body,
          version: state.backupPolicy.version + 1,
          updatedAt: new Date().toISOString(),
        };
        return sendJson(200, state.backupPolicy);
      }
    }

    // Fallback for unhandled /api/v1 routes
    return sendJson(200, { items: [], success: true });
  } catch (err: any) {
    console.error("Mock API error:", err);
    return sendJson(500, {
      message: err?.message || "Internal server error",
    });
  }
}

export function createMockApiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const rawUrl = req.originalUrl || req.url || "";
    const [pathname] = rawUrl.split("?");

    if (!pathname.startsWith("/api/v1")) {
      return next();
    }

    // Always set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Idempotency-Key, X-Requested-With",
    );
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const method = req.method ?? "GET";
    const body = await parseBody(req);
    const { status, data } = dispatchApi(method, rawUrl, body, req.headers);
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
  };
}
