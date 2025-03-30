import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

// Configuração do servidor
const PORT = 5678;

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

// Configurar servidor HTTP com Express e SSE
const app = express();
const transports: {[sessionId: string]: SSEServerTransport} = {};

app.get("/sse", async (_: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

// Iniciar o servidor HTTP
const httpServer = app.listen(PORT, () => {
  console.log(`Servidor MCP iniciado na porta ${PORT}`);
  console.log(`Para conectar ao servidor no Cursor IDE, use o seguinte URL: http://localhost:${PORT}`);
});

// Manipulação de encerramento
process.on('SIGINT', () => {
  console.log('Encerrando o servidor MCP...');
  httpServer.close(() => {
    console.log('Servidor MCP encerrado.');
    process.exit(0);
  });
}); 