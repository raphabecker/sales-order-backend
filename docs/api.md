# API contract

Base URL: `http://127.0.0.1:4004/odata/v4/main`. Authentication: the local Basic users documented in the README. Production identity is not configured.

The OData metadata is available at `GET /$metadata`. Amounts are BRL decimals with two fractional digits, usually serialized as strings. Consumers should use a decimal library or integer cents rather than floating-point arithmetic.

Use `npm run dev` for an ephemeral database or `npm run dev:persistent` to retain data in `.data/sales.sqlite`. Both modes expose the same API and local users.

## Resources

| Resource | Reads | Writes |
| --- | --- | --- |
| `/Customers` | admin, sales, reader | admin: POST, PATCH, DELETE |
| `/Products` | admin, sales, reader | admin: POST, PATCH, DELETE |
| `/SalesOrderHeaders` | admin, sales, reader | admin/sales: POST and bound cancel action |
| `/SalesOrderItems` | admin, sales, reader | Through creation of the parent order only |
| `/SalesOrderLogs` | admin | Append only from the order workflow |

Use `/Resource(UUID)` to address one record. Master-data PATCH/DELETE and cancellation require `If-Match`. A current ETag provides optimistic concurrency control; `If-Match: *` opts into applying to the current version.

## Customers and products

Customer creation requires `firstName` (1–80 characters), `lastName` (1–100) and `email` (1–255). Names are trimmed. Email is trimmed, lowercased, checked for basic address syntax and constrained to be unique. Reads preserve stored data and selected fields. Partial updates validate only the provided fields.

Product creation requires `name` (1–255), non-negative `price` (at most two decimal places), and non-negative 32-bit integer `stock` (defaults to zero). Free products are allowed. Price is limited to Decimal(15,2), up to 9,999,999,999,999.99.

A customer or product referenced by an order cannot be deleted, even after cancellation. Catalog price changes do not rewrite historical order items.

## Create an order

`POST /SalesOrderHeaders`, authenticated as admin or sales:

```json
{
  "customers_id": "38373147-201c-4e8d-bef6-165e14070769",
  "items": [
    {
      "product_id": "8dd64f22-69d8-4141-b402-9216d5677437",
      "quantity": 2
    }
  ]
}
```

The customer and all products must already exist. Inline customer creation is rejected. There must be between 1 and 100 items, each referencing a distinct product, with a positive 32-bit integer quantity. Duplicate products are rejected; clients should combine quantities before submitting.

IDs are generated when omitted. A caller may supply UUIDs, but repeated creation with an existing UUID returns 409 and rolls the transaction back. This is conflict detection, not a complete idempotency-key protocol.

Prices are read from the catalog. Submitted totals, prices, currency, status and managed audit fields cannot override server values. The server returns:

```json
{
  "id": "<generated UUID>",
  "customers_id": "38373147-201c-4e8d-bef6-165e14070769",
  "currency": "BRL",
  "subtotalAmount": "599.80",
  "discountAmount": "0.00",
  "totalAmount": "599.80",
  "status": "OPEN",
  "items": [
    {
      "id": "<generated UUID>",
      "product_id": "8dd64f22-69d8-4141-b402-9216d5677437",
      "quantity": 2,
      "price": "299.90"
    }
  ]
}
```

Additional OData and managed audit properties are returned. Totals above BRL 30,000 receive a 10% discount, rounded half up to cents. The threshold is strict: BRL 30,000 receives no discount. Out-of-range totals are rejected.

Creation reserves inventory, inserts the order and its items, and appends a CREATED audit event in the same transaction. Any failure rolls the entire request back. Competing requests receive a 409 if inventory is no longer sufficient.

## Cancel an order

`POST /SalesOrderHeaders(UUID)/MainService.cancel`

```http
Content-Type: application/json
If-Match: *

{}
```

Returns the order in `CANCELLED` state. The transition and stock restoration are transactional. Repeating this request with a matching or wildcard precondition returns the cancelled order without another stock adjustment or audit event.

If inventory cannot be restored within the supported range, the response is 409 and the order remains OPEN. Direct PATCH/DELETE of orders or their items is forbidden. Cancelling does not remove financial history.

## Queries

```text
GET /Products?$filter=stock gt 0&$orderby=name&$top=10&$skip=0&$count=true
GET /Customers(UUID)?$select=id,firstName
GET /SalesOrderHeaders(UUID)?$expand=items,customers
GET /SalesOrderLogs?$filter=header_id eq ORDER_UUID
```

OData parameters should be URL encoded when constructing URLs programmatically. Log queries require the admin role. Each audit event includes `event`, `actor`, `createdAt`, `header_id` and a JSON business snapshot in `orderData`.

## Error responses

| HTTP status | Meaning |
| --- | --- |
| 400 | Invalid payload or unsupported amount |
| 401 | Missing or invalid authentication |
| 403 | Role cannot perform this operation |
| 404 | Referenced customer, product or order was not found |
| 405 | Operation is not supported on a read-only resource |
| 409 | Insufficient stock, duplicate key/email, protected reference or failed stock restoration |
| 412 | ETag precondition is stale |
| 428 | Required `If-Match` header is missing |

Errors use the OData `{"error":{"code":"...","message":"..."}}` envelope. Clients should evaluate the HTTP status and display the returned message. Generic framework validation can reject malformed UUIDs, unknown properties or invalid scalar types before application handlers run.
