import { CustomerControllerImpl } from '../../controllers/customer/implementation.js';
import { customerService } from '../services/customer.js';

export const customerController = new CustomerControllerImpl(customerService);
