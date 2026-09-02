import { authenticatedFetch } from "../auth/auth-api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type ReceiptPaperSize = "A4" | "RECEIPT_80MM";

export type BusinessProfile = {
  id: string;
  storeName: string;
  shortName: string;
  phone: string | null;
  address: string | null;
  receiptFooter: string | null;
  defaultPaperSize: ReceiptPaperSize;
  version: number;
  updatedAt: string;
  updatedBy: { id: string; displayName: string } | null;
};

export type BusinessProfileInput = {
  storeName: string;
  shortName: string;
  phone?: string;
  address?: string;
  receiptFooter?: string;
  defaultPaperSize: ReceiptPaperSize;
  version: number;
};

export type DatabaseBackup = {
  id: string;
  fileName: string;
  createdAt: string;
  createdBy: { id: string; displayName: string } | null;
  kind: "MANUAL" | "AUTOMATIC" | "PRE_RESTORE";
  format: "PG_CUSTOM";
  sizeBytes: number;
  sha256: string;
  entryCount: number;
  status: "VERIFIED" | "INVALID";
  verifiedAt: string;
};

export type BackupPolicy = {
  enabled: boolean;
  backupTime: string;
  retentionCount: number;
  secondaryCopyEnabled: boolean;
  secondaryDirectory: string;
  version: number;
  nextRunAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  lastSecondaryCopyAt: string | null;
  lastSecondaryCopyFailureAt: string | null;
  lastSecondaryCopyFailureMessage: string | null;
  updatedAt: string;
  updatedBy: { id: string; displayName: string } | null;
};

export type BackupList = {
  items: DatabaseBackup[];
  operation: "BACKUP" | "RESTORE" | null;
  restoreConfirmationHint: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join("；")
      : (body?.detail ?? body?.message);
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const administrationApi = {
  profile: () => request<BusinessProfile>("/administration/business-profile"),
  updateProfile: (input: BusinessProfileInput) =>
    request<BusinessProfile>("/administration/business-profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  backups: () => request<BackupList>("/administration/backups"),
  backupPolicy: () => request<BackupPolicy>("/administration/backups/policy"),
  updateBackupPolicy: (
    input: Pick<
      BackupPolicy,
      | "enabled"
      | "backupTime"
      | "retentionCount"
      | "secondaryCopyEnabled"
      | "secondaryDirectory"
      | "version"
    >,
  ) =>
    request<BackupPolicy>("/administration/backups/policy", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  createBackup: () =>
    request<DatabaseBackup>("/administration/backups", { method: "POST" }),
  verifyBackup: (id: string) =>
    request<DatabaseBackup>(`/administration/backups/${id}/verify`, {
      method: "POST",
    }),
  restoreBackup: (id: string, confirmation: string) =>
    request<{
      restoredBackup: DatabaseBackup;
      safetyBackup: DatabaseBackup;
      restoredAt: string;
    }>(`/administration/backups/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ confirmation }),
    }),
  downloadBackup: async (backup: DatabaseBackup) => {
    const response = await authenticatedFetch(
      `${API_BASE}/administration/backups/${backup.id}/download`,
    );
    if (!response.ok) throw new Error(`下载失败（${response.status}）`);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = backup.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
