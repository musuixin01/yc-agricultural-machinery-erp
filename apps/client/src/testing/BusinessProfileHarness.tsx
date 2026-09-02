import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BusinessProfileSettings } from "../modules/administration/BusinessProfileSettings";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function BusinessProfileHarness() {
  return (
    <QueryClientProvider client={queryClient}>
      <BusinessProfileSettings />
    </QueryClientProvider>
  );
}
