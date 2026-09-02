import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerReceiptVoucherDialog } from "../modules/receivables/CustomerReceiptVoucherDialog";
import type { CustomerReceipt } from "../modules/receivables/receivables-api";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function CustomerReceiptVoucherHarness({
  receipt,
}: {
  receipt: CustomerReceipt;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerReceiptVoucherDialog
        receipt={receipt}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  );
}
