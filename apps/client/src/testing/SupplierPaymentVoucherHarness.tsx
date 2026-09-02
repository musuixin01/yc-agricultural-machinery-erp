import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SupplierPayment } from "../modules/payables/payables-api";
import { SupplierPaymentVoucherDialog } from "../modules/payables/SupplierPaymentVoucherDialog";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function SupplierPaymentVoucherHarness({
  payment,
}: {
  payment: SupplierPayment;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupplierPaymentVoucherDialog
        payment={payment}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  );
}
