import { useEffect, useState } from "react";
import {
  ArchiveRestore,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Download,
  HardDriveDownload,
  HardDrive,
  Info,
  KeyRound,
  PackageCheck,
  RefreshCw,
  Save,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  administrationApi,
  type BackupPolicy,
  type DatabaseBackup as Backup,
} from "./administration-api";
import {
  useBackupMutations,
  useBackupPolicy,
  useBackups,
} from "./use-administration";

export function BackupRecoverySettings() {
  const backups = useBackups();
  const policy = useBackupPolicy();
  const mutations = useBackupMutations();
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [notice, setNotice] = useState("");

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice("");
    try {
      await action();
      setNotice(success);
      return true;
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "操作失败，请重试。",
      );
      return false;
    }
  }

  return (
    <div className="backup-center">
      <section className="backup-summary">
        <div className="backup-summary-copy">
          <span className="backup-icon">
            <DatabaseBackup aria-hidden="true" />
          </span>
          <div>
            <small>DATABASE SAFETY</small>
            <h2>数据备份与恢复</h2>
            <p>
              备份商品、库存、销售和账目。每份文件均经过归档结构与完整性校验。
            </p>
          </div>
        </div>
        <button
          className="primary-button"
          disabled={
            mutations.create.isPending || Boolean(backups.data?.operation)
          }
          onClick={() =>
            void run(
              () => mutations.create.mutateAsync(),
              "新备份已创建并校验通过。",
            )
          }
        >
          <HardDriveDownload aria-hidden="true" />
          {mutations.create.isPending ? "正在安全备份…" : "立即备份"}
        </button>
      </section>

      <div className="backup-assurance">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>恢复前自动保护</strong>
          <span>系统会先保存当前数据快照，再开始覆盖恢复。</span>
        </div>
        <div>
          <strong>双重校验</strong>
          <span>SHA-256 文件指纹 + PostgreSQL 归档结构检查。</span>
        </div>
      </div>

      <AutomaticBackupPolicy
        policy={policy.data}
        pending={mutations.updatePolicy.isPending}
        onSave={(input) =>
          run(
            () => mutations.updatePolicy.mutateAsync(input),
            input.enabled ? "每日自动备份已启用。" : "每日自动备份已暂停。",
          )
        }
      />

      {notice && (
        <p className="backup-notice" role="status">
          {notice}
        </p>
      )}
      <section className="backup-list-card">
        <header>
          <div>
            <h3>可用恢复点</h3>
            <span>{backups.data?.items.length ?? 0} 份</span>
          </div>
          <button
            aria-label="刷新备份列表"
            onClick={() => void backups.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            刷新
          </button>
        </header>
        {backups.isLoading && (
          <div className="catalog-state">正在读取备份记录…</div>
        )}
        {backups.isError && (
          <div className="catalog-state error">备份记录加载失败。</div>
        )}
        {backups.data?.items.length === 0 && (
          <div className="backup-empty">
            <DatabaseBackup aria-hidden="true" />
            <strong>还没有备份</strong>
            <span>点击“立即备份”建立第一个安全恢复点。</span>
          </div>
        )}
        <div className="backup-list">
          {backups.data?.items.map((backup) => (
            <article key={backup.id}>
              <div className={`backup-status ${backup.status.toLowerCase()}`}>
                {backup.status === "VERIFIED" ? (
                  <CheckCircle2 />
                ) : (
                  <TriangleAlert />
                )}
              </div>
              <div className="backup-main">
                <div>
                  <strong>{formatTime(backup.createdAt)}</strong>
                  <em>
                    {backup.kind === "PRE_RESTORE"
                      ? "恢复前快照"
                      : backup.kind === "AUTOMATIC"
                        ? "自动备份"
                        : "手动备份"}
                  </em>
                </div>
                <span>
                  {formatBytes(backup.sizeBytes)} · {backup.entryCount}{" "}
                  个归档对象 · {backup.createdBy?.displayName ?? "自动任务"}
                </span>
                <code title={backup.sha256}>
                  SHA-256 {backup.sha256.slice(0, 12)}…
                </code>
              </div>
              <div className="backup-actions">
                <button
                  disabled={mutations.verify.isPending}
                  onClick={() =>
                    void run(
                      () => mutations.verify.mutateAsync(backup.id),
                      "完整性复核通过。",
                    )
                  }
                >
                  复核
                </button>
                <button
                  onClick={() =>
                    void run(
                      () => administrationApi.downloadBackup(backup),
                      "备份文件已开始下载。",
                    )
                  }
                >
                  <Download />
                  下载
                </button>
                <button
                  className="danger-quiet"
                  disabled={backup.status !== "VERIFIED"}
                  onClick={() => setRestoring(backup)}
                >
                  <ArchiveRestore />
                  恢复
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <p className="backup-footnote">
        重要备份请下载到另一块硬盘或云盘；只保存在本机不能防止硬盘损坏。
      </p>
      <section
        className="backup-coverage"
        aria-labelledby="backup-coverage-title"
      >
        <header>
          <Info aria-hidden="true" />
          <div>
            <h3 id="backup-coverage-title">这份备份包含什么</h3>
            <p>凡是保存在玉春 ERP 正式数据库中的记录，都会进入同一个恢复点。</p>
          </div>
        </header>
        <div>
          <article>
            <span className="included">
              <PackageCheck aria-hidden="true" />
            </span>
            <div>
              <strong>已经备份</strong>
              <ul>
                <li>商品、分类、条码、仓库、库位、库存余额与库存流水</li>
                <li>采购、销售、退货、冲销及其全部商品明细</li>
                <li>客户、供应商、客户人像、加密身份证资料与联系方式</li>
                <li>客户欠款、供应商欠款、收付款、预收预付和资金账户</li>
                <li>员工账号、岗位权限、门店设置和操作审计记录</li>
              </ul>
            </div>
          </article>
          <article>
            <span className="excluded">
              <KeyRound aria-hidden="true" />
            </span>
            <div>
              <strong>不在数据库备份中</strong>
              <ul>
                <li>程序安装包、源代码以及另存到手机或电脑的票据图片</li>
                <li>数据库密码、登录签名密钥和身份证资料解密密钥</li>
                <li>PostgreSQL 集群账号、表空间以及未来接入的外部附件目录</li>
              </ul>
            </div>
          </article>
        </div>
        <footer>
          恢复完成后，所有设备会自动退出登录，避免旧登录凭证重新生效。
        </footer>
      </section>
      {restoring && (
        <RestoreDialog
          backup={restoring}
          pending={mutations.restore.isPending}
          onClose={() => setRestoring(null)}
          onConfirm={async (confirmation) => {
            const succeeded = await run(
              () =>
                mutations.restore.mutateAsync({
                  id: restoring.id,
                  confirmation,
                }),
              "数据恢复完成，恢复前的当前数据也已自动保存。",
            );
            if (succeeded) setRestoring(null);
          }}
        />
      )}
    </div>
  );
}

function AutomaticBackupPolicy({
  policy,
  pending,
  onSave,
}: {
  policy: BackupPolicy | undefined;
  pending: boolean;
  onSave: (
    input: Pick<
      BackupPolicy,
      | "enabled"
      | "backupTime"
      | "retentionCount"
      | "secondaryCopyEnabled"
      | "secondaryDirectory"
      | "version"
    >,
  ) => Promise<boolean>;
}) {
  const [enabled, setEnabled] = useState(false);
  const [backupTime, setBackupTime] = useState("21:00");
  const [retentionCount, setRetentionCount] = useState(7);
  const [secondaryCopyEnabled, setSecondaryCopyEnabled] = useState(false);
  const [secondaryDirectory, setSecondaryDirectory] = useState("");
  useEffect(() => {
    if (!policy) return;
    setEnabled(policy.enabled);
    setBackupTime(policy.backupTime);
    setRetentionCount(policy.retentionCount);
    setSecondaryCopyEnabled(policy.secondaryCopyEnabled);
    setSecondaryDirectory(policy.secondaryDirectory);
  }, [policy]);
  if (!policy)
    return <div className="catalog-state">正在读取自动备份设置…</div>;
  return (
    <section className="backup-policy-card">
      <header>
        <span>
          <Clock3 aria-hidden="true" />
        </span>
        <div>
          <strong>每日自动备份</strong>
          <small>
            {enabled
              ? `下次执行：${formatTime(policy.nextRunAt)}`
              : "当前已暂停"}
          </small>
        </div>
        <label className="backup-switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <i />
          <b>{enabled ? "已开启" : "已关闭"}</b>
        </label>
      </header>
      {policy.lastFailureAt && (
        <p className="backup-policy-error" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>
            <strong>最近一次自动备份失败</strong>
            {policy.lastFailureMessage}
          </span>
        </p>
      )}
      <div className="backup-policy-fields">
        <label>
          <span>每天执行时间</span>
          <input
            type="time"
            value={backupTime}
            onChange={(event) => setBackupTime(event.target.value)}
          />
        </label>
        <label>
          <span>保留自动备份</span>
          <select
            value={retentionCount}
            onChange={(event) => setRetentionCount(Number(event.target.value))}
          >
            {[3, 7, 14, 21, 30].map((count) => (
              <option key={count} value={count}>
                {count} 份
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="backup-secondary-copy">
        <div className="backup-secondary-heading">
          <span>
            <HardDrive aria-hidden="true" />
          </span>
          <div>
            <strong>第二存储副本</strong>
            <small>
              {secondaryCopyEnabled
                ? policy.lastSecondaryCopyAt
                  ? `最近复制：${formatTime(policy.lastSecondaryCopyAt)}`
                  : "将在下次自动备份后复制"
                : "建议保存到另一块硬盘或移动硬盘"}
            </small>
          </div>
          <label className="backup-switch">
            <input
              type="checkbox"
              checked={secondaryCopyEnabled}
              onChange={(event) =>
                setSecondaryCopyEnabled(event.target.checked)
              }
            />
            <i />
            <b>{secondaryCopyEnabled ? "已开启" : "已关闭"}</b>
          </label>
        </div>
        {secondaryCopyEnabled && policy.lastSecondaryCopyFailureAt && (
          <p className="backup-policy-error" role="alert">
            <TriangleAlert aria-hidden="true" />
            <span>
              <strong>第二存储复制失败</strong>
              {policy.lastSecondaryCopyFailureMessage}
            </span>
          </p>
        )}
        {secondaryCopyEnabled && (
          <label className="backup-secondary-path">
            <span>第二存储目录</span>
            <input
              value={secondaryDirectory}
              onChange={(event) => setSecondaryDirectory(event.target.value)}
              placeholder="例如 E:\\玉春备份"
              aria-describedby="backup-secondary-help"
            />
            <small id="backup-secondary-help">
              填写运行玉春服务的主机目录；移动硬盘断开时本机备份仍会保留。
            </small>
          </label>
        )}
      </div>
      <div className="backup-policy-actions">
        <button
          className="outline-button"
          onClick={() =>
            void onSave({
              enabled,
              backupTime,
              retentionCount,
              secondaryCopyEnabled,
              secondaryDirectory,
              version: policy.version,
            })
          }
          disabled={
            pending ||
            (secondaryCopyEnabled && secondaryDirectory.trim().length === 0)
          }
        >
          <Save aria-hidden="true" />
          {pending ? "正在保存…" : "保存全部设置"}
        </button>
      </div>
      <footer>
        本机与第二存储只清理超出数量的“自动备份”；手动备份和恢复前快照不会删除。
      </footer>
    </section>
  );
}

function RestoreDialog({
  backup,
  pending,
  onClose,
  onConfirm,
}: {
  backup: Backup;
  pending: boolean;
  onClose: () => void;
  onConfirm: (confirmation: string) => Promise<void>;
}) {
  const expected = `恢复 ${backup.id}`;
  const [confirmation, setConfirmation] = useState("");
  return (
    <div
      className="catalog-dialog-backdrop backup-dialog-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="catalog-dialog backup-restore-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>高风险操作</small>
            <h2 id="restore-title">恢复历史数据</h2>
          </div>
          <button aria-label="关闭" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="backup-restore-body">
          <div className="backup-danger">
            <TriangleAlert />
            <div>
              <strong>恢复会把当前数据库替换为所选时间点</strong>
              <span>
                操作期间请让其他员工停止开单。系统会先自动备份当前数据，失败时不会部分写入。
              </span>
            </div>
          </div>
          <dl>
            <div>
              <dt>恢复时间点</dt>
              <dd>{formatTime(backup.createdAt)}</dd>
            </div>
            <div>
              <dt>完整性</dt>
              <dd>
                <CheckCircle2 />
                已校验
              </dd>
            </div>
          </dl>
          <label>
            <span>
              输入 <b>{expected}</b> 继续
            </span>
            <input
              autoFocus
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
        <footer>
          <button
            className="outline-button"
            onClick={onClose}
            disabled={pending}
          >
            取消
          </button>
          <button
            className="danger-button"
            disabled={pending || confirmation !== expected}
            onClick={() => void onConfirm(confirmation)}
          >
            {pending ? "正在备份当前数据并恢复…" : "确认恢复"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatTime(value: string | null) {
  if (!value) return "尚未安排";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
