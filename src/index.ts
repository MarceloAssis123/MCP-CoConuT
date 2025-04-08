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
          descriptionShort: "Processa pensamentos em cadeia com ramificações e análise de qualidade",
          descriptionLong: "Permite modelos de linguagem raciocinar passo a passo, mantendo histórico de pensamentos e possibilitando ramificações. Suporta revisão de pensamentos anteriores, análise automática da qualidade do raciocínio, detecção de ciclos, e ajustes dinâmicos no número total de pensamentos. Retorna resultado em formato JSON com análise integrada.",
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
        throw new Error("The project path cannot be empty");
      }
      if (!params.WhyChange) {
        throw new Error("The reason for change cannot be empty");
      }
      if (!params.WhatChange) {
        throw new Error("The change description cannot be empty");
      }

      // Chamar o método saveWithStorage do serviço CoConuT com todos os parâmetros
      const savedFiles = await coconutService.saveWithStorage(
        params.projectPath,
        params.WhyChange,
        params.WhatChange,
        {
          // Passar os parâmetros opcionais para enriquecer a conclusão
          category: params.category,
          subCategories: params.subCategories,
          tags: params.tags,
          impactLevel: params.impactLevel,
          affectedFiles: params.affectedFiles,
          codeSnippets: params.codeSnippets,
          relatedConclusions: params.relatedConclusions,
          ticketReference: params.ticketReference,
          businessContext: params.businessContext,
          alternativesConsidered: params.alternativesConsidered,
          testingPerformed: params.testingPerformed,
          technicalContext: params.technicalContext
        }
      );

      // Configurar o caminho do projeto no serviço para futuras interações automáticas
      coconutService.setProjectPath(params.projectPath);
      logger.info("Project path configured for automatic saving", { projectPath: params.projectPath });

      // Formatar resposta
      const result = {
        success: true,
        message: "Thoughts saved successfully!",
        savedFilesCount: savedFiles.length,
        savedFiles: savedFiles.map(file => ({
          path: file.filePath,
          type: file.type,
          timestamp: new Date(file.timestamp).toISOString()
        })),
        // Incluir parâmetros na resposta para referência
        whyChange: params.WhyChange,
        whatChange: params.WhatChange,
        category: params.category,
        tags: params.tags,
        impactLevel: params.impactLevel,
        autoSaveEnabled: true
      };

      logger.info("CoConuT_Storage executed successfully", {
        projectPath: params.projectPath,
        filesCount: savedFiles.length,
        whyChange: params.WhyChange,
        whatChange: params.WhatChange,
        category: params.category,
        tags: params?.tags?.length,
        impactLevel: params.impactLevel,
        autoSaveEnabled: true
      });

      // Retornar resposta no formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }],
        _meta: {
          description: "Ferramenta de armazenamento persistente para cadeias de pensamento do CoConuT",
          readOnly: false,
          isDestructive: true,
          category: "storage",
          descriptionShort: "Salva pensamentos, conclusões e histórico de interações em armazenamento persistente",
          descriptionLong: "Permite salvar a cadeia de pensamentos gerada em arquivos persistentes, criar conclusões estruturadas e enriquecidas e manter um histórico de interações. A ferramenta cria ou atualiza arquivos no sistema de arquivos com base no caminho fornecido, gera uma conclusão formatada com metadados, seções padronizadas, categorização e contextualização a partir dos parâmetros fornecidos, e configura o salvamento automático de futuras interações no arquivo conclusion.md. Fornece respostas detalhadas sobre os arquivos salvos, incluindo contagem, timestamps e caminhos. Inclui suporte para categorização, tags, níveis de impacto, snippets de código, referências cruzadas e outros metadados que otimizam o retrieval pelo modelo.",
          requiresUserAction: true,
          schemaVersion: "2025-03-26"
        }
      };
    } catch (error: any) {
      logger.error("Error in CoConuT_Storage tool", { error });

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
  thoughts: z.array(z.any()).describe("Array containing the thoughts to be analyzed"),
  projectPath: z.string().optional().describe("Project path for additional context"),
  userQuery: z.string().optional().describe("Original user query to check alignment")
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
        throw new Error("At least one thought must be provided for analysis");
      }

      // Realizar a análise usando o analisador
      const result = analyser.analyseChainOfThought(params.thoughts);

      // Adicionar informações contextuais à resposta
      const response = {
        ...result,
        analyzedThoughts: params.thoughts.length,
        originalQuery: params.userQuery || "Not provided",
        timestamp: new Date().toISOString()
      };

      logger.info("CoConuT_Analyser executed successfully", {
        analyzedThoughts: params.thoughts.length,
        isOnRightTrack: result.isOnRightTrack,
        needsMoreUserInfo: result.needsMoreUserInfo,
        suggestedTotalThoughts: result.suggestedTotalThoughts
      });

      // Retornar resposta no formato esperado pelo MCP
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response, null, 2)
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
      logger.error("Error in CoConuT_Analyser tool", { error });

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
    logger.info("CoConuT service initialized successfully");
  } catch (error: any) {
    // Se for um erro esperado, apenas logar como informação
    if (error?.message?.includes('No path was provided')) {
      logger.info("CoConuT service waiting for first call with valid path");
    } else {
      // Para outros erros, logar como erro
      logger.error("Error initializing CoConuT service", { error });
    }
  }
})();

// Selecionar e configurar o transporte
let transport = new StdioServerTransport();
logger.info("MCP server running in stdio mode");

// Conectar o servidor ao transporte
server.connect(transport).catch(error => {
  logger.error("Error connecting MCP server", { error });
  process.exit(1);
});

// Manipulação de encerramento
process.on('SIGINT', () => {
  logger.info('Shutting down MCP server...');
  process.exit(0);
}); 