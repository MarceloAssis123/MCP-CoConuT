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
      text: "Olá do servidor MCP! Ele é capaz de resolver problemas com pensamento contínuo em cadeia."
    }]
  })
);

// Estado para a ferramenta chainOfThought
let thoughtHistory: Array<{
  thought: string;
  thoughtNumber: number;
  branchId?: string;
  score?: number;
  timestamp: number;
}> = [];
let interactionCount = 0;
let branches: Record<string, Array<number>> = { 'main': [] };
let currentBranch = 'main';
let userInputRequired = false;
let lastProblemStatus = "";

// Tipos para inputs variados
const InputTypes = {
  TEXT: 'text',
  NUMBER_ARRAY: 'number_array',
  BOOLEAN: 'boolean',
  OPTIONS: 'options'
};

let currentInputType = InputTypes.TEXT;
const inputTypeSequence = [
  InputTypes.TEXT,
  InputTypes.TEXT,
  InputTypes.NUMBER_ARRAY,
  InputTypes.TEXT,
  InputTypes.OPTIONS
];

// Detectar padrões cíclicos no pensamento
function detectCycles(thoughts: string[], threshold = 0.8): boolean {
  if (thoughts.length < 4) return false;

  const lastThought = thoughts[thoughts.length - 1];
  for (let i = 0; i < thoughts.length - 1; i++) {
    const similarity = calculateSimilarity(lastThought, thoughts[i]);
    if (similarity > threshold) {
      return true;
    }
  }
  return false;
}

// Função simples para calcular similaridade entre strings
function calculateSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  // Calcular distância de Levenshtein simplificada
  let costs = [];
  for (let i = 0; i <= shorter.length; i++) {
    costs[i] = i;
  }

  for (let i = 1; i <= longer.length; i++) {
    costs[0] = i;
    let nw = i - 1;
    for (let j = 1; j <= shorter.length; j++) {
      const cj = Math.min(
        costs[j] + 1,
        costs[j - 1] + 1,
        nw + (longer.charAt(i - 1) === shorter.charAt(j - 1) ? 0 : 1)
      );
      nw = costs[j];
      costs[j] = cj;
    }
  }

  // Converter distância em similaridade (1 - distância normalizada)
  return 1.0 - (costs[shorter.length] / longer.length);
}

// Implementação Chain-of-Thought melhorada
server.tool(
  "CoConuT",
  {
    thought: z.string(),
    nextThoughtNeeded: z.boolean(),
    thoughtNumber: z.number(),
    totalThoughts: z.number().min(3), // Garantir mínimo de 3 pensamentos
    isRevision: z.boolean().optional(),
    revisesThought: z.number().optional(),
    branchFromThought: z.number().optional(),
    branchId: z.string().optional(),
    needsMoreThoughts: z.boolean().optional(),
    score: z.number().optional(),
    inputType: z.string().optional(),
    problemStatus: z.string().optional(),
    options: z.array(z.string()).optional(),
    numberArray: z.array(z.number()).optional()
  },
  async (params) => {
    interactionCount++;
    const {
      thought,
      thoughtNumber,
      totalThoughts,
      nextThoughtNeeded,
      isRevision = false,
      revisesThought,
      branchFromThought,
      branchId = currentBranch,
      score,
      problemStatus,
      numberArray,
      options
    } = params;

    // Verificar se precisamos de input do usuário da interação anterior
    if (userInputRequired) {
      userInputRequired = false;
      // Processar o input do usuário conforme o tipo esperado
      if (currentInputType === InputTypes.NUMBER_ARRAY && numberArray) {
        // Processar array de números
      } else if (currentInputType === InputTypes.OPTIONS && options) {
        // Processar opções selecionadas
      }
    }

    // Gerenciar ramificações
    if (branchFromThought && branchId && branchId !== currentBranch) {
      currentBranch = branchId;
      if (!branches[branchId]) {
        branches[branchId] = [branchFromThought];
      }
    }

    // Armazenar o pensamento no histórico
    const thoughtEntry = {
      thought,
      thoughtNumber,
      branchId: currentBranch,
      score: score || 0,
      timestamp: Date.now()
    };

    if (isRevision && revisesThought) {
      // Atualizar um pensamento existente em vez de adicionar novo
      const index = thoughtHistory.findIndex(t =>
        t.thoughtNumber === revisesThought && t.branchId === currentBranch
      );
      if (index >= 0) {
        thoughtHistory[index] = thoughtEntry;
      } else {
        thoughtHistory.push(thoughtEntry);
      }
    } else {
      thoughtHistory.push(thoughtEntry);
    }

    // Atualizar o status do problema se fornecido
    if (problemStatus) {
      lastProblemStatus = problemStatus;
    }

    // Detectar ciclos no raciocínio
    const thoughtsInCurrentBranch = thoughtHistory
      .filter(t => t.branchId === currentBranch)
      .map(t => t.thought);

    const hasCycle = detectCycles(thoughtsInCurrentBranch);

    // Preparar resposta
    let response: any = {
      thoughtNumber,
      totalThoughts,
      nextThoughtNeeded,
      branches: Object.keys(branches),
      currentBranch,
      thoughtHistoryLength: thoughtHistory.length,
      hasCycle
    };

    // A cada 3 interações, adicionar reflexão sobre os três pontos
    if (interactionCount % 3 === 0) {
      const reflexionPoints = {
        isProblemBeingSolved: lastProblemStatus || "Não foi fornecido status do problema ainda",
        shouldIncreaseTotalThoughts: thoughtNumber >= totalThoughts * 0.7, // Sugere aumentar se já usou 70%
        needsUserInput: hasCycle || thoughtNumber >= totalThoughts * 0.8 // Sugere input do usuário se detectar ciclo ou estiver próximo do fim
      };

      // Solicitar input do usuário se necessário
      if (reflexionPoints.needsUserInput) {
        userInputRequired = true;
        currentInputType = inputTypeSequence[Math.min(Math.floor(interactionCount / 3), inputTypeSequence.length - 1)];

        if (currentInputType === InputTypes.NUMBER_ARRAY) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                ...response,
                reflexionPoints,
                action: "REQUEST_INPUT",
                inputType: "NUMBER_ARRAY",
                message: "Por favor, forneça um array de números relevantes para o problema."
              }, null, 2)
            }]
          };
        } else if (currentInputType === InputTypes.OPTIONS) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                ...response,
                reflexionPoints,
                action: "REQUEST_INPUT",
                inputType: "OPTIONS",
                message: "Selecione uma das opções para prosseguir:",
                options: ["Continuar no caminho atual", "Explorar nova ramificação", "Revisar pensamentos anteriores"]
              }, null, 2)
            }]
          };
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ...response,
            reflexionPoints,
            action: "REFLECTION"
          }, null, 2)
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