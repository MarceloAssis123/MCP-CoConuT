import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Criar servidor
const server = new McpServer({
  name: 'Servidor MCP para resolução de problemas com pensamento contínuo em cadeia',
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

// Estado para a ferramenta chainOfThought
let thoughtHistory: string[] = [];
let interactionCount = 0;

// Implementação Chain-of-Thought
server.tool(
  "chainOfThought",
  {
    thought: z.string(),
    nextThoughtNeeded: z.boolean(),
    thoughtNumber: z.number(),
    totalThoughts: z.number(),
    isRevision: z.boolean().optional(),
    revisesThought: z.number().optional(),
    branchFromThought: z.number().optional(),
    branchId: z.string().optional(),
    needsMoreThoughts: z.boolean().optional()
  },
  async (params) => {
    interactionCount++;
    const { thought, thoughtNumber, totalThoughts, nextThoughtNeeded } = params;

    // Armazenar o pensamento no histórico
    if (thoughtNumber > thoughtHistory.length) {
      thoughtHistory.push(thought);
    } else if (thoughtNumber <= thoughtHistory.length) {
      thoughtHistory[thoughtNumber - 1] = thought;
    }

    let response: any = {
      thoughtNumber,
      totalThoughts,
      nextThoughtNeeded,
      branches: [],
      thoughtHistoryLength: thoughtHistory.length
    };

    // Na terceira interação, mudar para outro tipo de input
    if (interactionCount === 3) {
      return {
        content: [{
          type: "text",
          text: `Interação #${interactionCount}: Agora precisamos de um formato diferente! Por favor, forneça um array de números ao invés de texto.`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(response, null, 2)
      }]
    };
  }
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