import { DomainError } from './errors.js';

export interface OrderItemInput {
  id?: string;
  product_id: string;
  quantity: number;
}

export interface PricedOrderItem extends OrderItemInput {
  price: string;
}

export function validateItems(value: unknown): OrderItemInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new DomainError(400, 'An order must have between 1 and 100 items', 'items');
  }
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new DomainError(400, 'Invalid order item', 'items');
    const item = entry as Partial<OrderItemInput>;
    if (typeof item.product_id !== 'string' || !item.product_id) {
      throw new DomainError(400, 'Every item must reference a product', 'items');
    }
    if (!Number.isInteger(item.quantity) || item.quantity! < 1 || item.quantity! > 2_147_483_647) {
      throw new DomainError(400, 'Quantity must be a positive 32-bit integer', 'items');
    }
    if (seen.has(item.product_id)) throw new DomainError(400, 'Duplicate products are not allowed', 'items');
    seen.add(item.product_id);
    return { id: item.id, product_id: item.product_id, quantity: item.quantity! };
  });
}
