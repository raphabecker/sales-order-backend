import type { CustomerProps } from '../../models/customer.js';
import type { CustomerController } from './protocols.js';
import type { CustomerService } from '../../services/customer/protocols.js';

export class CustomerControllerImpl implements CustomerController {
  constructor(private readonly service: CustomerService) {}

  beforeWrite(data: CustomerProps): CustomerProps {
    return this.service.prepare(data);
  }
}
