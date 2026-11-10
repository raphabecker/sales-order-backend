import { DomainError } from './errors.js';

// Decimal(15,2): at most 13 whole digits. Calculations never use floating point.
const MAX_CENTS = 999_999_999_999_999n;

export function toCents(value: unknown, field = 'price'): bigint {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new DomainError(400, field + ' must be a non-negative amount with at most two decimal places', field);
  }
  const [whole, fraction = ''] = text.split('.');
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > MAX_CENTS) throw new DomainError(400, field + ' exceeds the supported amount', field);
  return cents;
}

export function formatMoney(cents: bigint): string {
  if (cents < 0n || cents > MAX_CENTS) {
    throw new DomainError(400, 'Order amount exceeds the supported range', 'items');
  }
  return (cents / 100n).toString() + '.' + (cents % 100n).toString().padStart(2, '0');
}
