import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CoConuTService } from "./modules/coconut";
import { CoConuTParamsSchema, CoConuTResponse, CoConuTConfig } from "./modules/types";
import { Logger, LogLevel } from "./modules/logger";

// Configuração do CoConuT
const coconutConfig: CoConuTConfig = {
  maxHistorySize: 21,
  cycleDetectionThreshold: 0.8,
  persistenceEnabled: false,
  maxBranches: 10,
  reflectionInterval: 3
};

// Instanciar o serviço CoConuT
const coconutService = new CoConuTService(coconutConfig);

// Configurar o logger
const logger = Logger.getInstance({
  minLevel: LogLevel.INFO,
  enableConsole: true,
  includeTimestamp: true
});

// Criar servidor MCP
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
      text: "Olá do servidor MCP! Ele é capaz de resolver problemas com pensamento contínuo em cadeia."
    }]
  })
);

// Implementação da ferramenta CoConuT usando o serviço refatorado
server.tool(
  "CoConuT",
  CoConuTParamsSchema.shape,
  async (params) => {
    try {
      // Processar a requisição com o serviço CoConuT
      const response: CoConuTResponse = await coconutService.processRequest(params);

      // Converter resposta para o formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error: any) {
      logger.error("Erro na ferramenta CoConuT", { error });

      // Retornar erro em formato compatível
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error.message,
            thoughtNumber: params.thoughtNumber,
            totalThoughts: params.totalThoughts,
            nextThoughtNeeded: false
          }, null, 2)
        }]
      };
    }
  }
);

// Inicialização do serviço
(async () => {
  try {
    await coconutService.initialize();
    logger.info("Serviço CoConuT inicializado com sucesso");
  } catch (error: any) {
    logger.error("Erro ao inicializar o serviço CoConuT", { error });
  }
})();

// Usar o transporte stdio em vez de HTTP
const transport = new StdioServerTransport();
logger.info("Servidor MCP rodando no modo stdio");

// Conectar o servidor ao transporte
server.connect(transport).catch(error => {
  logger.error("Erro ao conectar o servidor MCP", { error });
  process.exit(1);
});

// Manipulação de encerramento
process.on('SIGINT', () => {
  logger.info('Encerrando o servidor MCP...');
  process.exit(0);
}); 