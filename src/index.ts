/**
 * Ponto de entrada para o Servidor MCP com CoConuT (Continuous Chain of Thought)
 * Implementa o servidor MCP e expõe a ferramenta CoConuT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CoConuTService } from "./modules/coconut";
import { CoConuTParams, CoConuTParamsSchema, CoConuTStorageParams, CoConuTStorageParamsSchema } from "./modules/types";
import { Logger } from "./modules/logger";
import { config } from "./config";
import { FormatterFactory } from "./modules/formatters";

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
const coconutService = new CoConuTService({
  persistenceEnabled: true
  // Sem projectPath - o modelo deve fornecer em cada interação
});

// Log de configuração aplicada
logger.info("Configuração do CoConuT", {
  persistenceEnabled: true
});

// Log específico sobre o status do armazenamento
logger.info("Armazenamento de pensamentos configurado com validação. O modelo DEVE fornecer um caminho válido em cada interação.");

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
  async (params: CoConuTParams, extra) => {
    try {
      // Processar a requisição com o serviço CoConuT
      // O projectPath é obrigatório em cada interação e será utilizado para definir onde salvar os arquivos
      const response = await coconutService.processRequest(params);

      // Obter o formatador configurado (padrão: json)
      const formatter = FormatterFactory.createFormatter('json');
      const formattedResponse = formatter.format(response);

      // Retornar resposta no formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: formattedResponse.text
        }],
        _meta: {
          description: "Ferramenta de raciocínio contínuo em cadeia (Continuous Chain of Thought)",
          readOnly: true,
          category: "reasoning",
          descriptionShort: "Processa pensamentos em cadeia com formato JSON",
          descriptionLong: "Permite modelos de linguagem raciocinar passo a passo, mantendo histórico de pensamentos e possibilitando ramificações. Retorna resultado em formato JSON.",
          schemaVersion: "2025-03-26"
        }
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

// Implementação da ferramenta CoConuT_Storage
server.tool(
  "CoConuT_Storage",
  CoConuTStorageParamsSchema.shape,
  async (params: CoConuTStorageParams) => {
    try {
      // Validar os parâmetros obrigatórios
      if (!params.projectPath) {
        throw new Error("O caminho do projeto não pode estar vazio");
      }
      if (!params.WhyChange) {
        throw new Error("O motivo da mudança não pode estar vazio");
      }
      if (!params.WhatChange) {
        throw new Error("A descrição da mudança não pode estar vazia");
      }

      // Chamar o método saveWithStorage do serviço CoConuT
      const savedFiles = await coconutService.saveWithStorage(
        params.projectPath,
        params.WhyChange,
        params.WhatChange
      );

      // Formatar resposta
      const result = {
        success: true,
        message: "Pensamentos salvos com sucesso!",
        savedFilesCount: savedFiles.length,
        savedFiles: savedFiles.map(file => ({
          path: file.filePath,
          type: file.type,
          timestamp: new Date(file.timestamp).toISOString()
        })),
        whyChange: params.WhyChange,
        whatChange: params.WhatChange
      };

      logger.info("CoConuT_Storage executado com sucesso", {
        projectPath: params.projectPath,
        filesCount: savedFiles.length,
        whyChange: params.WhyChange,
        whatChange: params.WhatChange
      });

      // Retornar resposta no formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }],
        _meta: {
          description: "Salva pensamentos e conclusões em armazenamento persistente",
          readOnly: false,
          isDestructive: true,
          category: "storage",
          descriptionShort: "Salva pensamentos em armazenamento persistente",
          descriptionLong: "Permite salvar a cadeia de pensamentos gerada em arquivos persistentes. Cria ou atualiza arquivos no sistema de arquivos com base no caminho fornecido.",
          requiresUserAction: true,
          schemaVersion: "2025-03-26"
        }
      };
    } catch (error: any) {
      logger.error("Erro na ferramenta CoConuT_Storage", { error });

      // Retornar erro em formato compatível
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }
);

// Variante da ferramenta que utiliza formato Markdown
server.tool(
  "CoConuT_MD",
  CoConuTParamsSchema.shape,
  async (params: CoConuTParams, extra) => {
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
        }],
        _meta: {
          description: "Ferramenta de raciocínio contínuo com saída formatada em Markdown",
          readOnly: true,
          category: "reasoning",
          descriptionShort: "Processa pensamentos em cadeia com formato Markdown",
          descriptionLong: "Permite modelos de linguagem raciocinar passo a passo, mantendo histórico de pensamentos e possibilitando ramificações. Retorna resultado em formato Markdown para fácil leitura.",
          schemaVersion: "2025-03-26"
        }
      };
    } catch (error: any) {
      logger.error("Erro na ferramenta CoConuT_MD", { error });

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
  "CoConuT_HTML",
  CoConuTParamsSchema.shape,
  async (params: CoConuTParams, extra) => {
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
        }],
        _meta: {
          description: "Ferramenta de raciocínio contínuo com saída formatada em HTML",
          readOnly: true,
          category: "reasoning",
          descriptionShort: "Processa pensamentos em cadeia com formato HTML",
          descriptionLong: "Permite modelos de linguagem raciocinar passo a passo, mantendo histórico de pensamentos e possibilitando ramificações. Retorna resultado em formato HTML para visualização rica em interfaces web.",
          schemaVersion: "2025-03-26"
        }
      };
    } catch (error: any) {
      logger.error("Erro na ferramenta CoConuT_HTML", { error });

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
    // Se for um erro esperado, apenas logar como informação
    if (error?.message?.includes('Nenhum caminho foi fornecido')) {
      logger.info("Serviço CoConuT aguardando primeira chamada com caminho válido");
    } else {
      // Para outros erros, logar como erro
      logger.error("Erro ao inicializar o serviço CoConuT", { error });
    }
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