type CustomerProps = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

export class CustomerModel {
    constructor(private props: CustomerProps) {}

    public static create(props: CustomerProps) {
        return new CustomerModel(props);
    }
    
    public get id() {
        return this.props.id;
    }

        public get firstName() {
        return this.props.firstName;
    }

        public get lastName() {
        return this.props.lastName;
    }

        public get email() {
        return this.props.email;
    }

    public setDefautEmailDomain(): CustomerModel {
        if (!this.props.email.includes('@')) {
        // A interpolação ${...} monta o texto, como |{ valor }@gmail.com| em ABAP.
            this.props.email = `${this.props.email}@gmail.com`;
        }
        return this;
    }

    public toObjects(): CustomerProps {
        return {
            id: this.props.id,
            firstName: this.props.firstName,
            lastName: this.props.lastName,
            email: this.props.email
        }
    }
}