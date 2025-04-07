/**
 * Ponto de entrada para o Servidor MCP com CoConuT (Continuous Chain of Thought)
 * Implementa o servidor MCP e expõe a ferramenta CoConuT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CoConuTService } from "./modules/coconut";
import {
  CoConuTParams,
  CoConuTParamsSchema,
  CoConuTStorageParams,
  CoConuTStorageParamsSchema,
  ThoughtEntry
} from "./modules/types";
import { Logger } from "./modules/logger";
import { config } from "./config";
import { FormatterFactory } from "./modules/formatters";
import { AnalyserFactory } from "./modules/analyser";
import { z } from "zod";

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

// Criar instância do analisador
const analyser = AnalyserFactory.createAnalyser();

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

// Esquema Zod para parâmetros do CoConuT_Analyser
const CoConuTAnalyserParamsSchema = z.object({
  thoughts: z.array(z.any()).describe("Array contendo os pensamentos a serem analisados"),
  projectPath: z.string().optional().describe("Caminho do projeto para contexto adicional"),
  userQuery: z.string().optional().describe("Consulta original do usuário para verificar alinhamento")
});

// Interface para parâmetros do CoConuT_Analyser
interface CoConuTAnalyserParams {
  thoughts: ThoughtEntry[];
  projectPath?: string;
  userQuery?: string;
}

// Implementação da ferramenta CoConuT_Analyser
server.tool(
  "CoConuT_Analyser",
  CoConuTAnalyserParamsSchema.shape,
  async (params: CoConuTAnalyserParams) => {
    try {
      // Validar os parâmetros
      if (!params.thoughts || !Array.isArray(params.thoughts) || params.thoughts.length === 0) {
        throw new Error("É necessário fornecer pelo menos um pensamento para análise");
      }

      // Realizar a análise usando o analisador
      const resultado = analyser.analyseChainOfThought(params.thoughts);

      // Adicionar informações contextuais à resposta
      const resposta = {
        ...resultado,
        pensamentosAnalisados: params.thoughts.length,
        consultaOriginal: params.userQuery || "Não fornecida",
        timestamp: new Date().toISOString()
      };

      logger.info("CoConuT_Analyser executado com sucesso", {
        pensamentosAnalisados: params.thoughts.length,
        isOnRightTrack: resultado.isOnRightTrack,
        needsMoreUserInfo: resultado.needsMoreUserInfo,
        suggestedTotalThoughts: resultado.suggestedTotalThoughts
      });

      // Retornar resposta no formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: JSON.stringify(resposta, null, 2)
        }],
        _meta: {
          description: "Analisador da cadeia de pensamentos do CoConuT",
          readOnly: true,
          category: "analysis",
          descriptionShort: "Analisa a qualidade e direção da cadeia de pensamentos",
          descriptionLong: "Analisa se a cadeia de pensamentos está no caminho correto, se é necessário mais informações do usuário, e se o número de pensamentos é adequado para resolver o problema.",
          schemaVersion: "2025-03-26"
        }
      };
    } catch (error: any) {
      logger.error("Erro na ferramenta CoConuT_Analyser", { error });

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