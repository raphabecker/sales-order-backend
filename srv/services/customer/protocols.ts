import type { CustomerProps } from '../../models/customer.js';

export interface CustomerService {
  prepare(data: CustomerProps): CustomerProps;
}
