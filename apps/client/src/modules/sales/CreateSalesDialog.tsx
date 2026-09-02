import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Camera,
  Check,
  HandCoins,
  ImagePlus,
  Keyboard,
  MapPin,
  Mic,
  ScanBarcode,
  ScanText,
  Search,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { useProducts } from "../catalog/use-catalog";
import { useInventoryBalances } from "../inventory/use-inventory";
import { useParties } from "../parties/use-parties";
import { useCreateParty } from "../parties/use-parties";
import { useCashAccounts } from "../payables/use-payables";
import { useWarehouses } from "../warehouses/use-warehouses";
import { SalesCompletionError } from "./sales-api";
import { useCompleteSales } from "./use-sales";

type Line = { productId: string; quantity: string; unitPrice: string };
type SettlementType = "IMMEDIATE" | "CREDIT";
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 19);
};
const addDaysToBusinessDate = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const addMonthsToBusinessDate = (value: string, months: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
};

function normalizeSpokenIdentity(value: string) {
  const digits: Record<string, string> = {
    零: "0",
    〇: "0",
    一: "1",
    幺: "1",
    二: "2",
    两: "2",
    三: "3",
    四: "4",
    五: "5",
    六: "6",
    七: "7",
    八: "8",
    九: "9",
  };
  return value
    .toUpperCase()
    .replace(/[零〇一幺二两三四五六七八九]/g, (item) => digits[item])
    .replace(/叉/g, "X")
    .replace(/[^0-9X]/g, "")
    .slice(0, 18);
}

export function CreateSalesDialog({
  open,
  scanFirst = false,
  onClose,
}: {
  open: boolean;
  scanFirst?: boolean;
  onClose: () => void;
}) {
  const customers = useParties("", "CUSTOMER");
  const createCustomer = useCreateParty();
  const warehouses = useWarehouses("", "ACTIVE");
  const products = useProducts("", "", "ACTIVE");
  const balances = useInventoryBalances();
  const accounts = useCashAccounts();
  const complete = useCompleteSales();
  const [settlementType, setSettlementType] =
    useState<SettlementType>("IMMEDIATE");
  const [customerId, setCustomerId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [soldAt, setSoldAt] = useState(localDateTime());
  const [dueDate, setDueDate] = useState(localDateTime().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([]);
  const [barcode, setBarcode] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");
  const [savedAfterFailure, setSavedAfterFailure] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickIdentityNumber, setQuickIdentityNumber] = useState("");
  const [quickCustomerAddress, setQuickCustomerAddress] = useState("");
  const [quickPaymentTermsMonths, setQuickPaymentTermsMonths] = useState("1");
  const [quickPortrait, setQuickPortrait] = useState("");
  const [portraitViewerOpen, setPortraitViewerOpen] = useState(false);
  const [identityScanning, setIdentityScanning] = useState(false);
  const [listeningField, setListeningField] = useState<
    "identity" | "address" | null
  >(null);
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [quickCustomerError, setQuickCustomerError] = useState("");
  const barcodeInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const portraitInput = useRef<HTMLInputElement>(null);
  const identityScanInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraFrame = useRef<number | null>(null);
  const businessDate = soldAt.slice(0, 10);

  const available = useMemo(() => {
    const quantities = new Map(
      balances.data?.items
        .filter((item) => item.warehouse.id === warehouseId)
        .map((item) => [item.product.id, item.quantity]) ?? [],
    );
    return (
      products.data?.items
        .filter((item) => item.type !== "SERVICE")
        .map((item) => ({ ...item, available: quantities.get(item.id) ?? "0" }))
        .filter((item) => Number(item.available) > 0) ?? []
    );
  }, [products.data, balances.data, warehouseId]);
  const suggestions = useMemo(() => {
    const query = barcode.trim().toLowerCase();
    if (!query) return [];
    return available
      .filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          item.model?.toLowerCase().includes(query) ||
          item.specification?.toLowerCase().includes(query) ||
          item.barcodes.some((entry) => entry.barcode.includes(query)),
      )
      .slice(0, 6);
  }, [available, barcode]);

  useEffect(() => {
    if (!open) return;
    setSoldAt(localDateTime());
    setSettlementType("IMMEDIATE");
    setCustomerId("");
    setError("");
    setSavedAfterFailure(false);
    setAddingCustomer(false);
    setQuickCustomerError("");
    if (!warehouseId && warehouses.data?.items.length)
      setWarehouseId(
        warehouses.data.items.find((item) => item.isDefault)?.id ??
          warehouses.data.items[0].id,
      );
    if (!cashAccountId && accounts.data?.items.length)
      setCashAccountId(
        accounts.data.items.find((item) => item.status === "ACTIVE")?.id ?? "",
      );
    if (scanFirst) window.setTimeout(() => barcodeInput.current?.focus(), 80);
  }, [
    open,
    scanFirst,
    warehouseId,
    warehouses.data,
    cashAccountId,
    accounts.data,
  ]);

  useEffect(() => {
    const customer = customers.data?.items.find(
      (item) => item.id === customerId,
    );
    setDueDate(
      customer?.paymentTermsMonths
        ? addMonthsToBusinessDate(businessDate, customer.paymentTermsMonths)
        : addDaysToBusinessDate(businessDate, customer?.paymentTermsDays ?? 0),
    );
  }, [customerId, businessDate, customers.data]);
  useEffect(() => setLines([]), [warehouseId]);

  function stopCamera() {
    if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    cameraFrame.current = null;
    stream.current = null;
    setCameraOpen(false);
  }
  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    if (!open) setPhotoPreview("");
  }, [open]);
  useLayoutEffect(() => {
    document.body.classList.toggle("sales-dialog-open", open);
    return () => document.body.classList.remove("sales-dialog-open");
  }, [open]);
  if (!open) return null;

  const patchLine = (index: number, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );

  async function createCustomerInsideOrder() {
    const name = quickCustomerName.trim();
    const phone = quickCustomerPhone.trim();
    const identityNumber = quickIdentityNumber.trim().toUpperCase();
    const address = quickCustomerAddress.trim();
    if (!name || !phone || !identityNumber || !address) {
      setQuickCustomerError("请完整填写姓名、电话、身份证号码和地址。 ");
      return;
    }
    if (!/^[0-9+() -]{5,32}$/.test(phone)) {
      setQuickCustomerError("联系电话格式不正确。 ");
      return;
    }
    if (!/^\d{17}[\dX]$/.test(identityNumber)) {
      setQuickCustomerError("身份证号码应为 18 位，末位可以是 X。 ");
      return;
    }
    setQuickCustomerError("");
    try {
      const customer = await createCustomer.mutateAsync({
        code: `KH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        name,
        roles: ["CUSTOMER"],
        identityNumber,
        portraitDataUrl: quickPortrait || undefined,
        address,
        paymentTermsMonths: Number(quickPaymentTermsMonths || 0),
        contacts: phone
          ? [
              {
                name,
                phone,
                isPrimary: true,
              },
            ]
          : undefined,
      });
      setCreatedCustomer({ id: customer.id, name: customer.name });
      setCustomerId(customer.id);
      setDueDate(
        addMonthsToBusinessDate(
          businessDate,
          Number(quickPaymentTermsMonths || 0),
        ),
      );
      setAddingCustomer(false);
      setQuickCustomerName("");
      setQuickCustomerPhone("");
      setQuickIdentityNumber("");
      setQuickCustomerAddress("");
      setQuickPortrait("");
    } catch (reason) {
      setQuickCustomerError(
        reason instanceof Error ? reason.message : "新增客户失败，请重试。",
      );
    }
  }

  async function chooseCustomerPortrait(file?: File) {
    if (!file) return;
    setQuickCustomerError("");
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setQuickCustomerError("请选择不超过 10MB 的人像照片。 ");
      return;
    }
    const source = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = source;
      });
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas
        .getContext("2d")
        ?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.78),
      );
      if (!blob || blob.size > 1_572_864)
        throw new Error("人像压缩失败，请换一张照片。 ");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setQuickPortrait(dataUrl);
    } catch (reason) {
      setQuickCustomerError(
        reason instanceof Error ? reason.message : "无法读取这张人像照片。",
      );
    } finally {
      URL.revokeObjectURL(source);
    }
  }

  async function scanIdentityCard(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      setQuickCustomerError("请选择不超过 12MB 的身份证照片。");
      return;
    }
    setQuickCustomerError("");
    setIdentityScanning(true);
    let worker: Awaited<
      ReturnType<(typeof import("tesseract.js"))["createWorker"]>
    > | null = null;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1);
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789Xx",
      });
      const result = await worker.recognize(file);
      const candidates = result.data.text
        .toUpperCase()
        .replace(/[^0-9X]/g, "")
        .match(/\d{17}[\dX]/g);
      if (!candidates?.length)
        throw new Error("没有识别到 18 位身份证号码，请摆正证件后重拍。 ");
      setQuickIdentityNumber(candidates[0]);
    } catch (reason) {
      setQuickCustomerError(
        reason instanceof Error ? reason.message : "身份证扫描失败，请重试。",
      );
    } finally {
      await worker?.terminate();
      setIdentityScanning(false);
    }
  }

  function startVoiceInput(field: "identity" | "address") {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setQuickCustomerError(
        "当前设备不支持语音输入，请使用系统键盘的语音按钮。 ",
      );
      return;
    }
    setQuickCustomerError("");
    setListeningField(field);
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (field === "identity")
        setQuickIdentityNumber(normalizeSpokenIdentity(transcript));
      else setQuickCustomerAddress(transcript);
    };
    recognition.onerror = () =>
      setQuickCustomerError("没有听清，请靠近手机后重新说一遍。 ");
    recognition.onend = () => setListeningField(null);
    recognition.start();
  }

  function locateCustomerAddress() {
    if (!navigator.geolocation) {
      setQuickCustomerError("当前设备不支持定位，请手动填写地址。 ");
      return;
    }
    setQuickCustomerError("");
    setLocatingAddress(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = coords.latitude.toFixed(6);
        const longitude = coords.longitude.toFixed(6);
        const template = import.meta.env.VITE_REVERSE_GEOCODE_URL as
          string | undefined;
        if (template) {
          try {
            const response = await fetch(
              template
                .replace("{lat}", encodeURIComponent(latitude))
                .replace("{lng}", encodeURIComponent(longitude)),
            );
            const body = (await response.json()) as {
              address?: string;
              display_name?: string;
            };
            const address = body.address ?? body.display_name;
            if (address) setQuickCustomerAddress(address);
            else throw new Error();
          } catch {
            setQuickCustomerAddress(`定位：${latitude}, ${longitude}`);
            setQuickCustomerError("已取得定位，请补充乡镇、村和门牌号。 ");
          }
        } else {
          setQuickCustomerAddress(`定位：${latitude}, ${longitude}`);
          setQuickCustomerError("已取得定位，请补充乡镇、村和门牌号。 ");
        }
        setLocatingAddress(false);
      },
      () => {
        setLocatingAddress(false);
        setQuickCustomerError("定位失败，请检查定位权限或手动填写地址。 ");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  function addProduct(product: (typeof available)[number]) {
    const existingLine = lines.find((line) => line.productId === product.id);
    if (
      existingLine &&
      Number(existingLine.quantity || 0) >= Number(product.available)
    ) {
      setScanMessage(
        `${product.name} 当前最多可售 ${Number(product.available)} 个`,
      );
      return;
    }
    setLines((current) => {
      const existing = current.findIndex(
        (line) => line.productId === product.id,
      );
      if (existing >= 0)
        return current.map((line, index) =>
          index === existing
            ? { ...line, quantity: String(Number(line.quantity || 0) + 1) }
            : line,
        );
      const next = {
        productId: product.id,
        quantity: "1",
        unitPrice: product.retailPrice,
      };
      const blank = current.findIndex((line) => !line.productId);
      return blank >= 0
        ? current.map((line, index) => (index === blank ? next : line))
        : [...current, next];
    });
    setBarcode("");
    setScanMessage(`已加入：${product.name}`);
    barcodeInput.current?.focus();
  }

  function addScannedProduct(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    const exact = available.find(
      (item) =>
        item.code.toLowerCase() === normalized.toLowerCase() ||
        item.name.toLowerCase() === normalized.toLowerCase() ||
        item.barcodes.some((entry) => entry.barcode === normalized),
    );
    if (exact) {
      addProduct(exact);
      return;
    }
    if (suggestions.length === 1) {
      addProduct(suggestions[0]);
      return;
    }
    setScanMessage(
      suggestions.length
        ? `找到 ${suggestions.length} 个商品，请从下面点选`
        : `没有找到“${normalized}”对应的有库存商品`,
    );
  }

  function choosePhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(String(reader.result ?? ""));
      setScanMessage("照片已拍摄；自动识别尚未接入，请点选对应商品");
    };
    reader.readAsDataURL(file);
  }

  async function openCamera() {
    setScanMessage("");
    const Detector = (
      window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setScanMessage("当前设备不支持网页相机扫码，可使用扫码枪或手动输入条码");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.current = media;
      setCameraOpen(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (!video.current) return;
      video.current.srcObject = media;
      await video.current.play();
      const detector = new Detector({
        formats: ["code_128", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
      });
      const detect = async () => {
        if (!video.current || !stream.current) return;
        try {
          const result = await detector.detect(video.current);
          if (result[0]?.rawValue) {
            addScannedProduct(result[0].rawValue);
            stopCamera();
            return;
          }
        } catch {
          /* Camera frames may be unavailable while warming up. */
        }
        cameraFrame.current = requestAnimationFrame(detect);
      };
      cameraFrame.current = requestAnimationFrame(detect);
    } catch {
      stopCamera();
      setScanMessage("无法打开相机，请检查相机权限，或使用扫码枪输入条码");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await complete.mutateAsync({
        settlementType,
        customerId: settlementType === "CREDIT" ? customerId : undefined,
        cashAccountId:
          settlementType === "IMMEDIATE"
            ? cashAccountId || undefined
            : undefined,
        warehouseId,
        businessDate,
        soldAt: new Date(soldAt).toISOString(),
        dueDate: settlementType === "CREDIT" ? dueDate : undefined,
        lines,
      });
      setLines([]);
      setBarcode("");
      setPhotoPreview("");
      stopCamera();
      onClose();
    } catch (reason) {
      if (reason instanceof SalesCompletionError) setSavedAfterFailure(true);
      setError(
        reason instanceof Error ? reason.message : "完成销售失败，请稍后重试",
      );
    }
  }

  return (
    <div
      className="catalog-dialog-backdrop"
      onMouseDown={() => {
        stopCamera();
        onClose();
      }}
    >
      <div
        className="catalog-dialog opening-dialog sales-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="销售开单"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sales-dialog-topbar">
          <div className="sales-mode-switch" aria-label="结算方式">
            <button
              type="button"
              className={settlementType === "IMMEDIATE" ? "active" : ""}
              onClick={() => {
                setSettlementType("IMMEDIATE");
                setCustomerId("");
                setAddingCustomer(false);
              }}
            >
              <Wallet />
              <strong>散客现结</strong>
            </button>
            <button
              type="button"
              className={settlementType === "CREDIT" ? "active" : ""}
              onClick={() => setSettlementType("CREDIT")}
            >
              <HandCoins />
              <strong>客户赊账</strong>
            </button>
          </div>
          <button
            className="sales-dialog-close"
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="sales-scanner">
            <div className="scanner-title">
              <span>
                <ScanBarcode />
                <strong>扫码添加商品</strong>
              </span>
              <small>支持扫码枪、手动条码和手机相机</small>
            </div>
            <div className="scanner-input-row">
              <label>
                <Keyboard />
                <input
                  ref={barcodeInput}
                  value={barcode}
                  placeholder="扫码，或输入名称、编号、条码"
                  onChange={(event) => setBarcode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addScannedProduct(barcode);
                    }
                  }}
                />
              </label>
              <button type="button" onClick={() => addScannedProduct(barcode)}>
                查找添加
              </button>
              <button
                type="button"
                className="camera-button"
                onClick={openCamera}
              >
                <Camera /> 相机扫码
              </button>
              <button
                type="button"
                className="photo-add-button"
                onClick={() => photoInput.current?.click()}
              >
                <ImagePlus /> 拍照找货
              </button>
              <input
                ref={photoInput}
                className="sales-photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  choosePhoto(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            {cameraOpen && (
              <div className="scanner-camera">
                <video ref={video} playsInline muted />
                <span>请将商品条码放入取景框</span>
                <button type="button" onClick={stopCamera}>
                  关闭相机
                </button>
              </div>
            )}
            {suggestions.length > 0 && barcode.trim() && (
              <div className="sales-product-suggestions">
                {suggestions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => addProduct(item)}
                  >
                    <strong>{item.name}</strong>
                    <small>
                      {item.code} · 库存 {Number(item.available)}
                    </small>
                  </button>
                ))}
              </div>
            )}
            {photoPreview && (
              <div className="sales-photo-picker">
                <img src={photoPreview} alt="刚拍摄的待匹配商品" />
                <div>
                  <strong>点选照片中的商品</strong>
                  <small>自动图片识别尚未接入，当前不保存照片</small>
                  <div>
                    {available.slice(0, 6).map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          addProduct(item);
                          setPhotoPreview("");
                        }}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {scanMessage && <p className="scanner-message">{scanMessage}</p>}
          </div>

          <div className="catalog-form-row">
            {settlementType === "CREDIT" ? (
              <div className="sales-credit-customer">
                <label>
                  <span>欠款客户 *</span>
                  <select
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    required
                  >
                    <option value="">请选择客户</option>
                    {createdCustomer &&
                      !customers.data?.items.some(
                        (item) => item.id === createdCustomer.id,
                      ) && (
                        <option value={createdCustomer.id}>
                          {createdCustomer.name}
                        </option>
                      )}
                    {customers.data?.items
                      .filter(
                        (item) =>
                          item.status === "ACTIVE" && item.code !== "YC-WALKIN",
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="sales-add-customer"
                  onClick={() => {
                    setAddingCustomer((current) => !current);
                    setQuickCustomerError("");
                  }}
                >
                  {addingCustomer ? <X /> : <UserPlus />}
                  {addingCustomer ? "收起" : "新增客户"}
                </button>
                {addingCustomer && (
                  <div className="sales-quick-customer">
                    <div className="quick-portrait-field">
                      <span>客户人像</span>
                      <div className="quick-portrait-actions">
                        <button
                          type="button"
                          className="quick-portrait-preview"
                          onClick={() =>
                            quickPortrait
                              ? setPortraitViewerOpen(true)
                              : portraitInput.current?.click()
                          }
                        >
                          {quickPortrait ? (
                            <img src={quickPortrait} alt="待保存的客户人像" />
                          ) : (
                            <Camera />
                          )}
                          <b>{quickPortrait ? "点击查看" : "拍摄人像"}</b>
                        </button>
                        {quickPortrait && (
                          <button
                            type="button"
                            className="quick-portrait-change"
                            onClick={() => portraitInput.current?.click()}
                          >
                            重拍
                          </button>
                        )}
                      </div>
                      <input
                        ref={portraitInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="user"
                        onChange={(event) => {
                          void chooseCustomerPortrait(event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </div>
                    <label className="quick-name">
                      <span>客户姓名/单位 *</span>
                      <input
                        value={quickCustomerName}
                        onChange={(event) =>
                          setQuickCustomerName(event.target.value)
                        }
                        maxLength={160}
                        placeholder="例如：王建国"
                        autoFocus
                      />
                    </label>
                    <label className="quick-phone">
                      <span>联系电话 *</span>
                      <input
                        value={quickCustomerPhone}
                        onChange={(event) =>
                          setQuickCustomerPhone(event.target.value)
                        }
                        inputMode="tel"
                        maxLength={32}
                        placeholder="用于联系和核对欠款"
                      />
                    </label>
                    <label className="quick-identity">
                      <span>身份证号码 *</span>
                      <div className="quick-input-actions">
                        <input
                          value={quickIdentityNumber}
                          onChange={(event) =>
                            setQuickIdentityNumber(
                              event.target.value.toUpperCase(),
                            )
                          }
                          inputMode="text"
                          maxLength={18}
                          placeholder="18 位身份证号码"
                        />
                        <button
                          type="button"
                          title="拍照扫描身份证号码"
                          disabled={identityScanning}
                          onClick={() => identityScanInput.current?.click()}
                        >
                          <ScanText />
                          <i>{identityScanning ? "识别中" : "扫描"}</i>
                        </button>
                        <button
                          type="button"
                          title="语音输入身份证号码"
                          className={
                            listeningField === "identity" ? "listening" : ""
                          }
                          onClick={() => startVoiceInput("identity")}
                        >
                          <Mic />
                          <i>语音</i>
                        </button>
                        <input
                          ref={identityScanInput}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          onChange={(event) => {
                            void scanIdentityCard(event.target.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>
                    </label>
                    <label className="quick-address">
                      <span>现住地址 *</span>
                      <div className="quick-input-actions">
                        <input
                          value={quickCustomerAddress}
                          onChange={(event) => {
                            setQuickCustomerAddress(event.target.value);
                            setQuickCustomerError("");
                          }}
                          maxLength={240}
                          placeholder="乡镇、村、街道及门牌号"
                        />
                        <button
                          type="button"
                          title="获取当前位置"
                          disabled={locatingAddress}
                          onClick={locateCustomerAddress}
                        >
                          <MapPin />
                          <i>{locatingAddress ? "定位中" : "定位"}</i>
                        </button>
                        <button
                          type="button"
                          title="语音输入地址"
                          className={
                            listeningField === "address" ? "listening" : ""
                          }
                          onClick={() => startVoiceInput("address")}
                        >
                          <Mic />
                          <i>语音</i>
                        </button>
                      </div>
                    </label>
                    <label className="quick-terms">
                      <span>默认账期（月）</span>
                      <select
                        value={quickPaymentTermsMonths}
                        onChange={(event) =>
                          setQuickPaymentTermsMonths(event.target.value)
                        }
                      >
                        <option value="0">当天</option>
                        <option value="1">1 个月</option>
                        <option value="2">2 个月</option>
                        <option value="3">3 个月</option>
                        <option value="6">6 个月</option>
                        <option value="12">12 个月</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="sales-save-customer"
                      disabled={createCustomer.isPending}
                      onClick={createCustomerInsideOrder}
                    >
                      <Check />
                      {createCustomer.isPending ? "保存中…" : "保存并选中"}
                    </button>
                    {quickCustomerError && <p>{quickCustomerError}</p>}
                  </div>
                )}
              </div>
            ) : (
              <label>
                <span>收款账户</span>
                <select
                  value={cashAccountId}
                  onChange={(event) => setCashAccountId(event.target.value)}
                >
                  <option value="">门店现金（自动）</option>
                  {accounts.data?.items
                    .filter((item) => item.status === "ACTIVE")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <div className="catalog-form-row">
            <label>
              <span>销售时间（精确到秒）*</span>
              <input
                type="datetime-local"
                step="1"
                value={soldAt}
                onChange={(event) => setSoldAt(event.target.value)}
                required
              />
            </label>
            {settlementType === "CREDIT" ? (
              <label>
                <span>约定付款日 *</span>
                <input
                  type="date"
                  min={businessDate}
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                />
              </label>
            ) : (
              <div className="immediate-note">
                <strong>本单为现结</strong>
                <span>过账后记入收款账户，不进入客户欠款。</span>
              </div>
            )}
          </div>

          <div className="opening-lines-title">
            <strong>销售商品</strong>
            <button type="button" onClick={() => barcodeInput.current?.focus()}>
              <Search /> 输入添加
            </button>
          </div>
          <div className="opening-lines">
            {lines.length === 0 && (
              <div className="sales-lines-empty">
                扫描一个商品，就会在这里出现一条销售商品
              </div>
            )}
            {lines.map((line, index) => {
              const product = available.find(
                (item) => item.id === line.productId,
              );
              return (
                <div className="opening-line" key={index}>
                  <label>
                    <span>商品</span>
                    <select
                      value={line.productId}
                      onChange={(event) => {
                        const selected = available.find(
                          (item) => item.id === event.target.value,
                        );
                        patchLine(index, {
                          productId: event.target.value,
                          unitPrice: selected?.retailPrice ?? "0",
                        });
                      }}
                      required
                    >
                      <option value="">扫码或选择有库存商品</option>
                      {available.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={lines.some(
                            (other, i) =>
                              i !== index && other.productId === item.id,
                          )}
                        >
                          {item.name} · 可售 {Number(item.available)}{" "}
                          {item.baseUnit.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>
                      数量
                      {product ? `（最多 ${Number(product.available)}）` : ""}
                    </span>
                    <input
                      value={line.quantity}
                      onChange={(event) =>
                        patchLine(index, { quantity: event.target.value })
                      }
                      inputMode="decimal"
                      pattern="\d{1,13}(\.\d{1,6})?"
                      required
                    />
                  </label>
                  <label>
                    <span>销售单价（元）</span>
                    <input
                      value={line.unitPrice}
                      onChange={(event) =>
                        patchLine(index, { unitPrice: event.target.value })
                      }
                      inputMode="decimal"
                      pattern="\d{1,15}(\.\d{1,4})?"
                      required
                    />
                  </label>
                  <button
                    type="button"
                    className="opening-remove"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              );
            })}
          </div>
          {available.length === 0 && warehouseId && (
            <p className="catalog-form-error">
              该仓库当前没有可销售库存，请先采购或建立期初库存。
            </p>
          )}
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button
              type="button"
              className="outline-button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
            >
              取消
            </button>
            <button
              className="primary-button"
              disabled={
                complete.isPending ||
                savedAfterFailure ||
                !available.length ||
                lines.length === 0
              }
            >
              {complete.isPending
                ? "正在完成销售…"
                : savedAfterFailure
                  ? "单据已保留，请关闭查看"
                  : settlementType === "IMMEDIATE"
                    ? "完成销售并收款"
                    : "完成赊账销售"}
            </button>
          </footer>
        </form>
        {portraitViewerOpen && quickPortrait && (
          <div
            className="customer-portrait-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="查看客户人像"
            onClick={() => setPortraitViewerOpen(false)}
          >
            <button
              type="button"
              aria-label="关闭人像预览"
              onClick={() => setPortraitViewerOpen(false)}
            >
              <X />
            </button>
            <img
              src={quickPortrait}
              alt="客户人像大图"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
