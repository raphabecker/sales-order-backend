// Define as entidades e os relacionamentos usados para persistir os dados da aplicação.
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
        // Referência ao cliente; o CAP deriva a chave estrangeira customers_id da chave de Customers.
        customers: Association to Customers;
        // Decimal com 15 dígitos no total e 2 casas decimais, semelhante a um campo DEC no DDIC.
        totalAmount: Decimal(15,2);
        // Composition define itens pertencentes ao pedido; many permite vários filhos.
        // A condição on liga o header do item ao pedido atual ($self).
        items: Composition of many SalesOrderItems on items.header = $self;
}

// Detalha os produtos de cada pedido, como a separação entre cabeçalho e itens em VBAK/VBAP.
entity SalesOrderItems {
    key id: UUID;
        header: Association to SalesOrderHeaders;
        product: Association to Products;
        // Integer representa quantidades inteiras, sem casas decimais.
        quantity: Integer;
        price: Decimal(15,2);
}

// Guarda dados do pedido e do usuário para consulta posterior; managed registra quando e por quem.
entity salesOrderLogs: managed {
    key id: UUID;
        // Liga cada log ao pedido correspondente, como uma referência por chave no DDIC.
        header: Association to SalesOrderHeaders;
        // LargeString armazena textos extensos; aqui, os dados são gravados como JSON.
        userData: LargeString;
        orderData: LargeString;
}

// Cadastro de clientes referenciados pelos pedidos.
entity Customers{
    key id: UUID;
        // String(20) limita o texto a 20 caracteres; os demais campos seguem o tamanho declarado.
        firstName: String(20);
        lastName: String(100);
        email: String(255);
}

// Cadastro de produtos com preço e saldo de estoque.
entity Products {
    key id: UUID;
        name: String(255);
        price: Decimal(15,2);
        stock: Integer;
}