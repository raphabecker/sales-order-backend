import type { CustomerProps } from '../../models/customer.js';

export interface CustomerController {
  beforeWrite(data: CustomerProps): CustomerProps;
}
