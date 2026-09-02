import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditProductDialog } from "../modules/catalog/EditProductDialog";
import type { Product } from "../modules/catalog/catalog-api";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const product: Product = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "LS-M12-045",
  name: "高强度螺栓 M12×45",
  mnemonicCode: "GQDLS",
  type: "STANDARD_PART",
  model: "M12×45",
  specification: "10.9级 / 镀锌",
  category: { id: "category-1", code: "FASTENER", name: "螺丝标准件" },
  brand: null,
  baseUnit: { id: "unit-1", code: "PCS", name: "个", decimalScale: 0 },
  retailPrice: "1.8000",
  wholesalePrice: "1.6000",
  defaultPurchasePrice: "1.1000",
  minimumSalePrice: "1.5000",
  safetyStock: "500.000000",
  barcodes: [{ id: "barcode-1", barcode: "690000000001", isPrimary: true }],
  attributes: {},
  status: "ACTIVE",
  version: 1,
};

export function ProductEditHarness() {
  return (
    <QueryClientProvider client={queryClient}>
      <EditProductDialog product={product} onClose={() => undefined} />
    </QueryClientProvider>
  );
}
