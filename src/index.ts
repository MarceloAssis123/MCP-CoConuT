import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Criar servidor
const server = new McpServer({
  name: 'Servidor MCP Básico',
  version: '1.0.0'
});

// Exemplo de recurso
server.resource(
  "hello",
  "custom://hello",
  async () => ({
    contents: [{
      uri: "custom://hello",
      text: "Olá do servidor MCP! Este é um recurso de exemplo."
    }]
  })
);

// Exemplo de ferramenta
server.tool(
  "echo",
  { texto: z.string() },
  async ({ texto }) => ({
    content: [{ 
      type: "text", 
      text: `Eco: ${texto}` 
    }]
  })
);

// Exemplo de prompt
server.prompt(
  "cumprimento", 
  { nome: z.string() },
  ({ nome }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Por favor, crie uma mensagem de cumprimento calorosa para ${nome}.`
        }
      }
    ]
  })
);

// Usar o transporte stdio em vez de HTTP
const transport = new StdioServerTransport();
console.log("Servidor MCP Básico rodando no modo stdio");

// Conectar o servidor ao transporte
server.connect(transport).catch(error => {
  console.error("Erro ao conectar o servidor MCP:", error);
  process.exit(1);
});

// Manipulação de encerramento
process.on('SIGINT', () => {
  console.log('Encerrando o servidor MCP...');
  process.exit(0);
}); 