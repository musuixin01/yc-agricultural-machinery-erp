import type { CreateWarehouseDto } from "./dto/create-warehouse.dto.js";
import type { QueryWarehousesDto } from "./dto/query-warehouses.dto.js";
import type {
  WarehousePage,
  WarehouseStatus,
  WarehouseView,
} from "./warehouses.types.js";

export const WAREHOUSES_REPOSITORY = Symbol("WAREHOUSES_REPOSITORY");

export interface WarehousesRepository {
  list(query: QueryWarehousesDto): Promise<WarehousePage>;
  findById(id: string): Promise<WarehouseView | null>;
  create(input: CreateWarehouseDto): Promise<WarehouseView>;
  updateStatus(
    id: string,
    status: WarehouseStatus,
    version: number,
  ): Promise<WarehouseView | null>;
  setDefault(id: string, version: number): Promise<WarehouseView | null>;
}
