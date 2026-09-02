import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupplierStatementDialog } from "../modules/payables/SupplierStatementDialog";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function SupplierStatementHarness({
  supplierId,
}: {
  supplierId: string;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupplierStatementDialog
        open
        initialSupplierId={supplierId}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  );
}
