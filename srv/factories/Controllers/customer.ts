import { CustomerControllerImpl } from "../../controllers/customer/implementation.js";
import { CustomerController } from "../../controllers/customer/protocols.js";
import { customerService } from '../services/customer.js'


const makeCustomerController = (): CustomerController => {
    return new CustomerControllerImpl(customerService);
}   

export const customerController = makeCustomerController();