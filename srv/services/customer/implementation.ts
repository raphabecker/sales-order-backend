import { Customers } from "@models/sales";
import { CustomerService } from "./protocols.js";
import { CustomerModel } from "../../models/customers.js";

export class CustomerServiceImpl implements CustomerService {
    public afterRead(customerList: Customers): Customers {
        const customers = customerList.map(c=>{
            const customer = CustomerModel.create({
                id: c.id as string,
                firstName: c.firstName as string,
                lastName: c.lastName as string,
                email: c.email as string
            });
            return customer
            .setDefautEmailDomain()
            .toObjects();
        });
        return customers;
    }
}