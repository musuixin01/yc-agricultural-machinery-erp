import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  MapPin,
  Phone,
  Printer,
  Save,
  Store,
} from "lucide-react";
import type { ReceiptPaperSize } from "./administration-api";
import {
  useBusinessProfile,
  useUpdateBusinessProfile,
} from "./use-administration";

export function BusinessProfileSettings() {
  const profile = useBusinessProfile();
  const update = useUpdateBusinessProfile();
  const [storeName, setStoreName] = useState("");
  const [shortName, setShortName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [paper, setPaper] = useState<ReceiptPaperSize>("A4");
  const [loadedVersion, setLoadedVersion] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile.data || profile.data.version === loadedVersion) return;
    setStoreName(profile.data.storeName);
    setShortName(profile.data.shortName);
    setPhone(profile.data.phone ?? "");
    setAddress(profile.data.address ?? "");
    setReceiptFooter(profile.data.receiptFooter ?? "");
    setPaper(profile.data.defaultPaperSize);
    setLoadedVersion(profile.data.version);
  }, [loadedVersion, profile.data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFeedback("");
    setError("");
    if (!storeName.trim() || !shortName.trim()) {
      setError("请填写门店名称和门店简称。");
      return;
    }
    try {
      const saved = await update.mutateAsync({
        storeName: storeName.trim(),
        shortName: shortName.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        receiptFooter: receiptFooter.trim() || undefined,
        defaultPaperSize: paper,
        version: loadedVersion,
      });
      setLoadedVersion(saved.version);
      setFeedback("门店资料已保存，新的销售单预览会立即使用这些内容。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请重试。");
    }
  }

  if (profile.isLoading)
    return <div className="catalog-state">正在加载门店资料…</div>;
  if (profile.isError)
    return (
      <div className="catalog-state error">
        门店资料加载失败。
        <button onClick={() => profile.refetch()}>重试</button>
      </div>
    );

  return (
    <div className="business-profile-settings">
      <form onSubmit={submit}>
        <div className="business-profile-heading">
          <span>
            <Store aria-hidden="true" />
          </span>
          <div>
            <h2>门店资料</h2>
            <p>用于销售单抬头和客户联系信息，不填写的内容不会出现在票据上。</p>
          </div>
        </div>
        <div className="business-profile-fields">
          <label>
            <span>门店名称 *</span>
            <input
              value={storeName}
              maxLength={80}
              onChange={(event) => setStoreName(event.target.value)}
            />
          </label>
          <label>
            <span>门店简称 *</span>
            <input
              value={shortName}
              maxLength={20}
              onChange={(event) => setShortName(event.target.value)}
            />
          </label>
          <label>
            <span>
              <Phone aria-hidden="true" />
              联系电话
            </span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              maxLength={30}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label className="wide">
            <span>
              <MapPin aria-hidden="true" />
              门店地址
            </span>
            <input
              value={address}
              maxLength={200}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <label className="wide">
            <span>票据底部说明</span>
            <textarea
              value={receiptFooter}
              maxLength={300}
              rows={3}
              onChange={(event) => setReceiptFooter(event.target.value)}
              placeholder="例如：感谢惠顾，配件安装前请核对型号。"
            />
            <small>{receiptFooter.length}/300，仅保存你实际填写的说明</small>
          </label>
        </div>
        <fieldset className="business-paper-setting">
          <legend>
            <Printer aria-hidden="true" />
            默认打印尺寸
          </legend>
          <label className={paper === "A4" ? "active" : ""}>
            <input
              type="radio"
              name="defaultPaper"
              value="A4"
              checked={paper === "A4"}
              onChange={() => setPaper("A4")}
            />
            <span>
              <b>A4 销售单</b>
              <small>适合整机、赊账和详细凭证</small>
            </span>
          </label>
          <label className={paper === "RECEIPT_80MM" ? "active" : ""}>
            <input
              type="radio"
              name="defaultPaper"
              value="RECEIPT_80MM"
              checked={paper === "RECEIPT_80MM"}
              onChange={() => setPaper("RECEIPT_80MM")}
            />
            <span>
              <b>80mm 小票</b>
              <small>适合配件零售和热敏打印机</small>
            </span>
          </label>
        </fieldset>
        {(error || feedback) && (
          <p
            className={
              error
                ? "business-profile-feedback error"
                : "business-profile-feedback"
            }
            role={error ? "alert" : "status"}
          >
            {!error && <CheckCircle2 aria-hidden="true" />}
            {error || feedback}
          </p>
        )}
        <footer>
          <span>
            {profile.data?.updatedBy
              ? `最近由 ${profile.data.updatedBy.displayName} 更新`
              : "尚未填写正式联系方式"}
          </span>
          <button
            className="primary-button"
            type="submit"
            disabled={update.isPending || loadedVersion === 0}
          >
            <Save aria-hidden="true" />
            {update.isPending ? "正在保存…" : "保存门店资料"}
          </button>
        </footer>
      </form>
      <aside className="business-profile-preview" aria-label="销售单抬头预览">
        <span>销售单抬头预览</span>
        <div className={paper === "RECEIPT_80MM" ? "receipt" : "a4"}>
          <strong>{storeName || "门店名称"}</strong>
          <small>{shortName || "简称"} · SALES RECEIPT</small>
          {phone && (
            <p>
              <Phone aria-hidden="true" />
              {phone}
            </p>
          )}
          {address && (
            <p>
              <MapPin aria-hidden="true" />
              {address}
            </p>
          )}
          <i>{paper === "A4" ? "A4" : "80mm"}</i>
        </div>
      </aside>
    </div>
  );
}
