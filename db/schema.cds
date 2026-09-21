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
}
