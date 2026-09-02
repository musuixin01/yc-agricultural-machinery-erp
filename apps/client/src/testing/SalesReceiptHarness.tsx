import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SalesDocument } from "../modules/sales/sales-api";
import { SalesReceiptDialog } from "../modules/sales/SalesReceiptDialog";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function SalesReceiptHarness({ document }: { document: SalesDocument }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SalesReceiptDialog document={document} onClose={() => undefined} />
    </QueryClientProvider>
  );
}
