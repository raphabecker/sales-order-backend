using { sales } from '../db/schema';

@path: '/odata/v4/main'
@requires: 'authenticated-user'
service MainService {
  @restrict: [
    { grant: 'READ', to: ['admin', 'sales_rep', 'read_only_user'] },
    { grant: 'CREATE', to: ['admin', 'sales_rep'] },
    { grant: 'cancel', to: ['admin', 'sales_rep'] }
  ]
  entity SalesOrderHeaders as projection on sales.SalesOrderHeaders actions {
    action cancel() returns SalesOrderHeaders;
  };

  @restrict: [{ grant: 'READ', to: ['admin', 'sales_rep', 'read_only_user'] }]
  entity SalesOrderItems as projection on sales.SalesOrderItems;

  @restrict: [
    { grant: 'READ', to: ['admin', 'sales_rep', 'read_only_user'] },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'admin' }
  ]
  entity Customers as projection on sales.Customers;

  @restrict: [
    { grant: 'READ', to: ['admin', 'sales_rep', 'read_only_user'] },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'admin' }
  ]
  entity Products as projection on sales.Products;

  @readonly
  @restrict: [{ grant: 'READ', to: 'admin' }]
  entity SalesOrderLogs as projection on sales.SalesOrderLogs;
}
