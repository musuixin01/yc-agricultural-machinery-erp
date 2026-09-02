import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PayablesWorkspace } from "../modules/payables/PayablesWorkspace";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function PayablesWorkspaceHarness() {
  return (
    <QueryClientProvider client={queryClient}>
      <PayablesWorkspace layout="mobile" />
    </QueryClientProvider>
  );
}
