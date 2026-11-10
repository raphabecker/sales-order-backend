import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CustomerModel } from '../srv/models/customer.js';
import { DomainError } from '../srv/models/errors.js';
import { formatMoney, toCents } from '../srv/models/money.js';
import { SalesOrderHeaderModel } from '../srv/models/sales-order-header.js';
import { validateItems } from '../srv/models/sales-order-item.js';

const product = (price: string, stock = 100) => ({ id: 'p1', name: 'Product', price, stock });
const input = (quantity = 1) => ({ customers_id: 'c1', items: [{ product_id: 'p1', quantity }] });

describe('money and order pricing (framework independent)', () => {
  it('adds fractional values exactly and formats cents', () => {
    assert.equal(formatMoney(toCents(0.1) + toCents(0.2)), '0.30');
    assert.equal(formatMoney(toCents('9999999999999.99')), '9999999999999.99');
  });

  for (const value of [-1, NaN, Infinity, null, undefined, '1.001', '1e3', '', '10000000000000.00']) {
    it('rejects invalid money: ' + String(value), () => {
      assert.throws(() => toCents(value), DomainError);
    });
  }

  it('uses catalog price and retains its value as a snapshot', () => {
    assert.equal(SalesOrderHeaderModel.price(input(3), [product('0.10')]).totalAmount, '0.30');
  });

  it('does not discount an order of exactly 30,000', () => {
    const order = SalesOrderHeaderModel.price(input(4), [product('7500.00')]);
    assert.equal(order.totalAmount, '30000.00');
    assert.equal(order.discountAmount, '0.00');
  });

  it('discounts strictly above the threshold, rounding half up', () => {
    const order = SalesOrderHeaderModel.price(input(), [product('30000.05')]);
    assert.equal(order.discountAmount, '3000.01');
    assert.equal(order.totalAmount, '27000.04');
  });

  it('rejects total overflow instead of silently rounding it', () => {
    assert.throws(() => SalesOrderHeaderModel.price(input(2), [product('9999999999999.99')]), DomainError);
  });

  it('rejects missing customers, missing products and insufficient stock', () => {
    assert.throws(() => SalesOrderHeaderModel.price({ items: input().items }, [product('1')]), DomainError);
    assert.throws(() => SalesOrderHeaderModel.price(input(), []), DomainError);
    assert.throws(() => SalesOrderHeaderModel.price(input(2), [product('1', 1)]), DomainError);
  });

  for (const quantity of [0, -1, 1.5, '1', null, 2_147_483_648]) {
    it('rejects invalid quantity: ' + String(quantity), () => {
      assert.throws(() => validateItems([{ product_id: 'p1', quantity }]), DomainError);
    });
  }

  it('rejects empty, malformed, excessive and duplicate items', () => {
    for (const value of [[], null, [null], [{}], [...input().items, ...input().items],
      Array.from({ length: 101 }, (_, index) => ({ product_id: String(index), quantity: 1 }))]) {
      assert.throws(() => validateItems(value), DomainError);
    }
  });
});

describe('customer normalization', () => {
  it('normalizes without mutating the input', () => {
    const original = { firstName: ' Ana ', email: ' ANA@EXAMPLE.COM ' };
    const result = CustomerModel.with(original).normalize().toObject();
    assert.deepEqual(result, { firstName: 'Ana', email: 'ana@example.com' });
    assert.equal(original.firstName, ' Ana ');
  });

  it('accepts partial updates without inventing omitted properties', () => {
    assert.deepEqual(CustomerModel.with({ lastName: ' Silva ' }).normalize().toObject(), { lastName: 'Silva' });
  });

  it('rejects empty names and malformed emails rather than inventing an email domain', () => {
    assert.throws(() => CustomerModel.with({ firstName: ' ' }).normalize(), DomainError);
    assert.throws(() => CustomerModel.with({ email: 'ana' }).normalize(), DomainError);
  });
});
