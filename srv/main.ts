// Importa a API do CAP e os tipos TypeScript usados para requisições e serviços.
import cds, { Request, Service } from '@sap/cds';
// Tipo gerado a partir do CDS; semelhante a usar um tipo do Dicionário ABAP.
import type { Customers, Products, SalesOrderItem, SalesOrderItems } from '@models/sales';

// Exporta a função que registra os handlers; a sintaxe => define uma função em JavaScript/TypeScript.
export default (service: Service) => {

    // Executa após a leitura de clientes e ajusta a resposta, sem gravar a alteração no banco.
    service.after('READ', 'Customers', (results: Customers) => {
        // Percorre o resultado como LOOP AT em ABAP; pressupõe uma coleção de clientes.
        results.forEach(customer => {
            // ?. evita acessar includes em um valor nulo/indefinido; ! nega a condição.
            if (!customer.email?.includes('@')) {
                // A interpolação ${...} monta o texto, como |{ valor }@gmail.com| em ABAP.
                customer.email = `${customer.email}@gmail.com`;
            }
        })
        
    });
    // Valida antes de criar o pedido; async permite aguardar a consulta com await.
    service.before('CREATE', 'SalesOrderHeaders', async (request: Request) => {
        // Acessa os dados recebidos; const impede reatribuir a variável, mas não torna o objeto imutável.
        const params = request.data;
        const items: SalesOrderItems = params.items;
        // Confere a referência ao cliente; o nome precisa coincidir com o campo exposto no serviço.
        if (!params.customer_id) {
            // Interrompe a criação com erro HTTP 400 (dados inválidos).
            return request.reject(400, 'Customer inválido');
        }
        // || significa OU; === compara sem conversão de tipo. Atenção: lenght deveria ser length.
        if (!params.items || params.items?.lenght ===0) {
            return request.reject(400, 'items inválidos');
        }
        // Monta uma consulta CQL de um único cliente, semelhante a SELECT SINGLE ... WHERE em ABAP.
        const customerQuery = SELECT.one.from('sales.Customers').where({ id: params.customer_id });
        // Executa a consulta; await aguarda o resultado da Promise antes de continuar neste handler.
        const customer = await cds.run(customerQuery);
        // Sem cliente correspondente, rejeita com HTTP 404 (não encontrado).
        if (!customer) {
            return request.reject(404, 'Customer não encontrado');
        }
        const productsIds: string[] = params.items.map((item: SalesOrderItem) => item.product_id);
        const productsQuery = SELECT.from('sales.Products').where({ productsIds });
        const products = await cds.run(productsQuery) as Products;
        for (const item of items) {
            const dbProduct = products.find(product => product.id ===item.product_id);
            if (!dbProduct) {
                return  request.reject(404, `Produto ${item.product_id} não encontrado`);
            }
            if (dbProduct.stock ===0) {
                return request.reject(400, `Produto ${dbProduct.name}(${dbProduct.id}) sem estoque disponivel`);
            }
        }
    });

}
