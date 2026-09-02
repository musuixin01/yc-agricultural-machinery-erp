import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerStatementDialog } from "../modules/receivables/CustomerStatementDialog";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function CustomerStatementHarness({
  customerId,
}: {
  customerId: string;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerStatementDialog
        open
        initialCustomerId={customerId}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  );
}
