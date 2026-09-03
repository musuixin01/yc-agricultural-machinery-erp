import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TransferDialog } from "../modules/inventory/TransferDialog";
import type { InventoryTransferDocument } from "../modules/inventory/inventory-api";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const sampleTransfer: InventoryTransferDocument = {
  id: "tr-test-1",
  documentNumber: "DB-20260902-0001",
  status: "DRAFT",
  businessDate: "2026-09-02",
  notes: "总库到配件专库测试移库",
  version: 1,
  totalAmount: "168.00",
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
  submittedBy: null,
  postedBy: null,
  submittedAt: null,
  postedAt: null,
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
      quantity: "10",
      unitCost: "16.80",
      lineAmount: "168.00",
    },
  ],
};

export function InventoryTransferHarness() {
  return (
    <QueryClientProvider client={queryClient}>
      <TransferDialog
        open={true}
        document={sampleTransfer}
        onChange={() => undefined}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  );
}
