using { managed } from '@sap/cds/common';

namespace sales;

annotate managed with {
  createdAt @readonly;
  createdBy @readonly;
  modifiedAt @readonly;
  modifiedBy @readonly;
};

@assert.unique.email: [email]
entity Customers : managed {
  key id : UUID;
  @mandatory firstName : String(80);
  @mandatory lastName : String(100);
  @mandatory email : String(255);
}

entity Products : managed {
  key id : UUID;
  @mandatory name : String(255);
  @mandatory price : Decimal(15,2);
  @mandatory stock : Integer default 0;
}

entity SalesOrderHeaders : managed {
  key id : UUID;
  customers : Association to Customers;
  @readonly currency : String(3) default 'BRL';
  @readonly subtotalAmount : Decimal(15,2);
  @readonly discountAmount : Decimal(15,2);
  @readonly totalAmount : Decimal(15,2);
  @readonly status : String(12) enum { OPEN; CANCELLED; } default 'OPEN';
  items : Composition of many SalesOrderItems on items.header = $self;
}

entity SalesOrderItems {
  key id : UUID;
  header : Association to SalesOrderHeaders;
  product : Association to Products;
  quantity : Integer;
  @readonly price : Decimal(15,2);
}

entity SalesOrderLogs : managed {
  key id : UUID;
  header : Association to SalesOrderHeaders;
  event : String(20);
  actor : String(255);
  orderData : LargeString;
}

annotate Customers with { modifiedAt @odata.etag; };
annotate Products with { modifiedAt @odata.etag; };
annotate SalesOrderHeaders with { modifiedAt @odata.etag; };
