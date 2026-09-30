// Importa a API do CAP e os tipos TypeScript usados para requisições e serviços.
import cds, { Request, Service } from '@sap/cds';
// import type traz apenas tipos gerados do CDS, como tipos DDIC; não carrega valores em execução.
import type { Customers, Product, Products, SalesOrderHeaders, SalesOrderItem, SalesOrderItems } from '@models/sales';
import { traceProcessWarnings } from 'node:process';

// Exporta a função que registra os handlers; a sintaxe => define uma função em JavaScript/TypeScript.
export default (service: Service) => {
    service.before('READ', '*', (request: Request) => {
        if (!request.user.is('read_only_user')) {
            return request.reject(403, 'Não autorizado')
        }
    })
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
        // Tipagem da coleção de itens, semelhante à declaração de uma tabela interna ABAP.
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
        // map cria um array de IDs a partir dos itens, semelhante a VALUE ... FOR em ABAP.
        const productsIds: string[] = params.items.map((item: SalesOrderItem) => item.product_id);
        // { productsIds } abrevia { productsIds: productsIds }; não equivale a filtrar id com IN.
        const productsQuery = SELECT.from('sales.Products').where({ productsIds });
        // as informa o tipo ao TypeScript; não converte nem valida os dados em execução.
        const products = await cds.run(productsQuery) as Products;
        // for...of percorre os valores; find retorna o primeiro produto correspondente, como READ TABLE.
        for (const item of items) {
            const dbProduct = products.find(product => product.id ===item.product_id);
            if (!dbProduct) {
                return  request.reject(404, `Produto ${item.product_id} não encontrado`);
            }
            // Rejeita estoque igual a zero; ainda não compara o saldo com a quantidade pedida.
            if (dbProduct.stock ===0) {
                return request.reject(400, `Produto ${dbProduct.name}(${dbProduct.id}) sem estoque disponivel`);
            }
        }
        let totalAmount = 0;
        items.forEach(item => {
            totalAmount += (item.price as number) . (item.quantity as number);
        });
        if (totalAmount > 30000) {
            const discount = totalAmount * (10/100)
            totalAmount = totalAmount - discount;
        }
        request.data.totalAmount - totalAmount;
    });
    // Após criar o pedido, atualiza o estoque; este evento ainda faz parte do processamento da requisição.
    service.after('CREATE', 'SalesOrderHeaders', async (results: SalesOrderHeaders, request: Request) => {
        // O ternário (condição ? valor : alternativa) normaliza objeto único ou lista para um array.
        const headersAsArray = Array.isArray(results) ? results : [results] as SalesOrderHeaders;
        for (const header of headersAsArray) {
            const items = header.items as SalesOrderItems;
            // ({ ... }) retorna um objeto por item, contendo apenas os dados necessários à baixa.
            const productsData = items.map(item => ({
                id: item.product_id as string,
                quantity: item.quantity as number
            }));
            const productsIds: string[] = productsData.map((productsData) => productsData.id);
            const productsQuery = SELECT.from('sales.Products').where({ productsIds });
            const products = await cds.run(productsQuery) as Products;
            for (const productData of productsData) {
                const foundProduct = products.find(product => product.id === productData.id) as Product;
                // Calcula o novo saldo em memória; a instrução seguinte persiste a baixa no banco.
                foundProduct.stock = (foundProduct.stock as number) - productData.quantity;
                // Equivale a UPDATE ... SET stock = ... WHERE id = ... em ABAP SQL.
                await cds.update('sales.Products').where({ id: foundProduct.id }).with({ stock: foundProduct.stock })
            }
            const headersAsString = JSON.stringify(header);
            const userAsString = JSON.stringify(request.user);
            const log = [{
                header_id: header.id,
                userData: userAsString,
                orderData: headersAsString
            }];
            await cds.create('sales.SalesOrderLogs').entries(log);
        }
    });
}
