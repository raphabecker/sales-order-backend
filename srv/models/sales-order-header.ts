import { DomainError } from './errors.js';
import { formatMoney, toCents } from './money.js';
import type { ProductProps } from './product.js';
import { validateItems } from './sales-order-item.js';
import type { PricedOrderItem } from './sales-order-item.js';

export interface OrderInput {
  id?: string;
  customers_id?: string;
  items?: unknown;
}

export interface OrderRecord {
  id: string;
  customers_id: string;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  status: 'OPEN' | 'CANCELLED';
  items: PricedOrderItem[];
}

export class SalesOrderHeaderModel {
  static price(input: OrderInput, products: ProductProps[]) {
    if (!input.customers_id) throw new DomainError(400, 'A customer is required', 'customers_id');
    const items = validateItems(input.items);
    const catalog = new Map(products.map(product => [product.id, product]));
    let subtotal = 0n;
    const pricedItems = items.map(item => {
      const product = catalog.get(item.product_id);
      if (!product) throw new DomainError(404, 'Product not found: ' + item.product_id, 'items');
      if (product.stock < item.quantity) throw new DomainError(409, 'Insufficient stock: ' + product.name, 'items');
      const cents = toCents(product.price);
      subtotal += cents * BigInt(item.quantity);
      return { ...item, price: formatMoney(cents) };
    });
    // A 10% discount applies strictly above BRL 30,000; round half up to cents.
    const discount = subtotal > 3_000_000n ? (subtotal + 5n) / 10n : 0n;
    return {
      items: pricedItems,
      currency: 'BRL',
      status: 'OPEN' as const,
      subtotalAmount: formatMoney(subtotal),
      discountAmount: formatMoney(discount),
      totalAmount: formatMoney(subtotal - discount),
    };
  }
}
