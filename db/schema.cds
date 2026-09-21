// Importa o aspecto managed (campos reutilizáveis) da biblioteca padrão do CAP; não é um import JavaScript.
using { managed } from '@sap/cds/common';

// Agrupa os nomes do modelo sob "sales", evitando conflitos entre entidades.
namespace sales;

// Define o cabeçalho do pedido; entidade persistente, semelhante a uma tabela na SE11.
// : managed inclui createdAt/By e modifiedAt/By, preenchidos automaticamente pelo CAP.
// Similar a um INCLUDE de estrutura ABAP com campos de criação e alteração.
entity SalesOrderHeaders: managed{
    // Chave primária: UUID é um identificador único, conceito equivalente ao GUID em ABAP.
    key id: UUID;
        customers: Association to Customers;
        totalAmount: Decimal(15,2);
        items: Composition of many SalesOrderItems on items.header = $self;
}

entity SalesOrderItems {
    key id: UUID;
        header: Association to SalesOrderHeaders;
        product: Association to Products;
        quantity: Integer;
        price: Decimal(15,2);
}

entity Customers{
    key id: UUID;
        firstName: String(20);
        lastName: String(100);
        email: String(255);
}

entity Products {
    key id: UUID;
        name: String(255);
        price: Decimal(15,2);
}