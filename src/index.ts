/**
 * Ponto de entrada para o Servidor MCP com CoConuT (Continuous Chain of Thought)
 * Implementa o servidor MCP e expõe a ferramenta CoConuT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CoConuTService } from "./modules/coconut";
import { CoConuTParamsSchema } from "./modules/types";
import { Logger } from "./modules/logger";
import { config } from "./config";
import { FormatterFactory } from "./modules/formatters";

// Processar argumentos da linha de comando para opções de configuração
function parseArgs() {
  const args = process.argv.slice(2);
  let configArg = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
      configArg = args[i + 1];
      break;
    }
  }

  // Se encontrou um argumento de configuração, tenta fazer parse do JSON
  let configObject = {};
  if (configArg) {
    try {
      configObject = JSON.parse(configArg);
      console.log('Configuração JSON carregada com sucesso');
    } catch (e) {
      console.error('Erro ao fazer parse do JSON de configuração:', e);
    }
  }

  return configObject;
}

// Extrair configurações específicas do CoConuT
function extractCoConutConfig(configObject: any) {
  const coconutConfig: Record<string, any> = {};

  // Extrair persistenceEnabled se presente
  if (configObject.persistenceEnabled !== undefined) {
    coconutConfig.persistenceEnabled = Boolean(configObject.persistenceEnabled);
  }

  return coconutConfig;
}

// Obter configurações do JSON passado via --config
const customConfig = parseArgs();
const coconutCustomConfig = extractCoConutConfig(customConfig);

// Configurar o logger com base na configuração
const logger = Logger.getInstance({
  minLevel: Logger.getLevelFromName(config.logging.minLevel),
  enableConsole: config.logging.enableConsole,
  includeTimestamp: config.logging.includeTimestamp,
  logFilePath: config.logging.logFilePath
});

// Criar e configurar o servidor MCP
const server = new McpServer({
  name: config.server.name,
  version: config.server.version
});

// Instanciar o serviço CoConuT com configuração personalizada
const coconutService = new CoConuTService(coconutCustomConfig);

// Log de configuração aplicada
logger.info("Configuração do CoConuT", {
  persistenceEnabled: coconutCustomConfig.persistenceEnabled !== undefined
    ? coconutCustomConfig.persistenceEnabled
    : config.coconut.persistenceEnabled
});

// Log específico sobre o status do armazenamento
const persistenceEnabled = coconutCustomConfig.persistenceEnabled !== undefined
  ? coconutCustomConfig.persistenceEnabled
  : config.coconut.persistenceEnabled;

if (persistenceEnabled) {
  logger.info("Armazenamento de pensamentos ATIVO. Os dados serão salvos na raiz do projeto atual.");
} else {
  logger.info("Armazenamento de pensamentos DESATIVADO. Os pensamentos não serão persistidos.");
}

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

// Implementação principal da ferramenta CoConuT
server.tool(
  "CoConuT",
  CoConuTParamsSchema.shape,
  async (params, extra) => {
    try {
      // Processar a requisição com o serviço CoConuT
      const response = await coconutService.processRequest(params);

      // Obter o formatador configurado (padrão: json)
      const formatter = FormatterFactory.createFormatter('json');
      const formattedResponse = formatter.format(response);

      // Retornar resposta no formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: formattedResponse.text
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

// Variante da ferramenta que utiliza formato Markdown
server.tool(
  "CoConuT-MD",
  CoConuTParamsSchema.shape,
  async (params, extra) => {
    try {
      // Processar a requisição com o serviço CoConuT
      const response = await coconutService.processRequest(params);

      // Formatar resposta como Markdown
      const formatter = FormatterFactory.createFormatter('markdown');
      const formattedResponse = formatter.format(response);

      // Retornar resposta no formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: formattedResponse.text
        }]
      };
    } catch (error: any) {
      logger.error("Erro na ferramenta CoConuT-MD", { error });

      // Retornar erro em formato compatível
      return {
        content: [{
          type: "text",
          text: `## Erro na ferramenta CoConuT\n\n${error.message}\n\n**Pensamento:** ${params.thoughtNumber} de ${params.totalThoughts}\n`
        }]
      };
    }
  }
);

// Variante da ferramenta que utiliza formato HTML
server.tool(
  "CoConuT-HTML",
  CoConuTParamsSchema.shape,
  async (params, extra) => {
    try {
      // Processar a requisição com o serviço CoConuT
      const response = await coconutService.processRequest(params);

      // Formatar resposta como HTML
      const formatter = FormatterFactory.createFormatter('html');
      const formattedResponse = formatter.format(response);

      // Retornar resposta no formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: formattedResponse.text
        }]
      };
    } catch (error: any) {
      logger.error("Erro na ferramenta CoConuT-HTML", { error });

      // Retornar erro em formato compatível
      return {
        content: [{
          type: "text",
          text: `<div class="error"><h2>Erro na ferramenta CoConuT</h2><p>${error.message}</p><p><strong>Pensamento:</strong> ${params.thoughtNumber} de ${params.totalThoughts}</p></div>`
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

// Selecionar e configurar o transporte
let transport = new StdioServerTransport();
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