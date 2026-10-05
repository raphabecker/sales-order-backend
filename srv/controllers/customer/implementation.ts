import { Customers } from "@models/sales";
import { CustomerController } from "./protocols.js";
import { CustomerService } from "../../services/customer/protocols.js";

export class CustomerControllerImpl implements CustomerController {
    constructor(private readonly service: CustomerService) {}
    
    public afterRead(customerList: Customers): Customers {
        return this.service.afterRead(customerList);
    }
}