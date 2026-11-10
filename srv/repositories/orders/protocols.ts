import type { ProductProps } from '../../models/product.js';
import type { OrderRecord } from '../../models/sales-order-header.js';

export interface OrderRepository {
  customerExists(id: string): Promise<boolean>;
  findProducts(ids: string[]): Promise<ProductProps[]>;
  reserveStock(id: string, quantity: number): Promise<boolean>;
  findOrder(id: string): Promise<OrderRecord | undefined>;
  claimCancellation(id: string): Promise<boolean>;
  restoreStock(id: string, quantity: number): Promise<boolean>;
  appendLog(order: OrderRecord, event: 'CREATED' | 'CANCELLED', actor: string): Promise<void>;
}
