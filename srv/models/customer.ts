import { DomainError } from './errors.js';

export interface CustomerProps {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export class CustomerModel {
  private constructor(private readonly props: CustomerProps) {}

  static with(props: CustomerProps): CustomerModel {
    return new CustomerModel({ ...props });
  }

  normalize(): CustomerModel {
    for (const field of ['firstName', 'lastName', 'email'] as const) {
      if (field in this.props) {
        const value = this.props[field];
        if (typeof value !== 'string' || !value.trim()) {
          throw new DomainError(400, field + ' must not be empty', field);
        }
        this.props[field] = value.trim();
      }
    }
    if (this.props.email !== undefined) {
      this.props.email = this.props.email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.props.email)) {
        throw new DomainError(400, 'A valid email address is required', 'email');
      }
    }
    return this;
  }

  toObject(): CustomerProps { return { ...this.props }; }
}
