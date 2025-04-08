/**
 * Configuração central para o servidor MCP com CoConuT
 * Define valores padrão para todas as configurações do sistema
 */

import { z } from "zod";

// Esquema para validação da configuração
export const ConfigSchema = z.object({
    // Configurações do CoConuT
    coconut: z.object({
        // Tamanho máximo do histórico de pensamentos
        maxHistorySize: z.number().positive().default(1000),

        // Limiar para detecção de ciclos (0-1)
        cycleDetectionThreshold: z.number().min(0).max(1).default(0.8),

        // Se a persistência de dados está ativada
        persistenceEnabled: z.boolean().default(true),

        // Número máximo de ramificações permitidas
        maxBranches: z.number().positive().default(10),

        // Intervalo de reflexão (a cada quantos pensamentos)
        reflectionInterval: z.number().positive().default(3),

        // Algoritmo de similaridade a ser usado
        similarityAlgorithm: z.enum(['levenshtein', 'jaccard', 'cosine']).default('levenshtein'),

        // Se o cache de similaridade está ativado
        enableSimilarityCache: z.boolean().default(true),

        // Tamanho máximo do cache de similaridade
        maxCacheSize: z.number().positive().default(1000)
    }),

    // Configurações do servidor
    server: z.object({
        // Nome do servidor
        name: z.string().default('Servidor MCP para resolução de problemas com pensamento contínuo em cadeia'),

        // Versão do servidor
        version: z.string().default('1.0.0'),

        // Tipo de transporte (fixo como stdio)
        transport: z.literal('stdio').default('stdio')
    }),

    // Configurações de logging
    logging: z.object({
        // Nível mínimo de log
        minLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

        // Se logs devem ser enviados para o console
        enableConsole: z.boolean().default(true),

        // Se logs devem incluir timestamp
        includeTimestamp: z.boolean().default(true),

        // Caminho para arquivo de log (opcional)
        logFilePath: z.string().optional()
    })
});

// Tipo para configuração
export type Config = z.infer<typeof ConfigSchema>;

// Configuração com valores padrão
const defaultConfig: Config = {
    coconut: {
        maxHistorySize: 1000,
        cycleDetectionThreshold: 0.8,
        persistenceEnabled: true,
        maxBranches: 10,
        reflectionInterval: 3,
        similarityAlgorithm: 'levenshtein',
        enableSimilarityCache: true,
        maxCacheSize: 1000
    },
    server: {
        name: 'Servidor MCP para resolução de problemas com pensamento contínuo em cadeia',
        version: '1.0.0',
        transport: 'stdio'
    },
    logging: {
        minLevel: 'info',
        enableConsole: true,
        includeTimestamp: true,
        logFilePath: undefined
    }
};

// Validar e exportar configuração como singleton
export const config = ConfigSchema.parse(defaultConfig);

// Exportar função para atualizar configuração em tempo de execução (útil para testes)
export function updateConfig(partialConfig: Partial<Config>): Config {
    const newConfig = {
        ...config,
        coconut: {
            ...config.coconut,
            ...(partialConfig.coconut || {})
        },
        server: {
            ...config.server,
            ...(partialConfig.server || {})
        },
        logging: {
            ...config.logging,
            ...(partialConfig.logging || {})
        }
    };

    // Validar nova configuração
    return ConfigSchema.parse(newConfig);
} 