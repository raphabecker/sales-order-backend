import { CustomerModel } from '../../models/customer.js';
import type { CustomerProps } from '../../models/customer.js';
import type { CustomerService } from './protocols.js';

export class CustomerServiceImpl implements CustomerService {
  prepare(data: CustomerProps): CustomerProps {
    return CustomerModel.with(data).normalize().toObject();
  }
}
