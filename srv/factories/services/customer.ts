import { CustomerService } from '../../services/customer/protocols.js';
import { CustomerServiceImpl } from '../../services/customer/implementation.js';

const makeCustomerService =(): CustomerService => {
    return new CustomerServiceImpl();
}

export const customerService = makeCustomerService();