// Importa o namespace sales do modelo de dados para referenciar suas entidades.
using { sales } from '../db/schema';

// Define o serviço que expõe entidades aos consumidores, semelhante a um serviço SAP Gateway.
service MainService {
    // Expõe a entidade do banco por uma projeção CDS, sem criar outra tabela.
    // Sem uma lista de campos, a projeção inclui todos os campos da entidade de origem.
    entity SalesOrderHeaders as projection on sales.SalesOrderHeaders;
    entity Customers as projection on sales.Customers;
    entity Products as projection on sales.Products;

}