/**
 * Tipos e interfaces para o servidor MCP com CoConuT
 */

import { z } from "zod";

// Enumeração para tipos de entrada
export enum InputType {
    TEXT = 'text',
    NUMBER_ARRAY = 'number_array',
    BOOLEAN = 'boolean',
    OPTIONS = 'options'
}

// Interface para informações sobre arquivos salvos
export interface SavedFileInfo {
    filePath: string;
    type: 'thought' | 'branch' | 'conclusion';
    timestamp: number;
}

// Interface para entradas de pensamento
export interface ThoughtEntry {
    thought: string;
    thoughtNumber: number;
    branchId: string;
    score: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

// Interface para parâmetros da ferramenta CoConuT
export interface CoConuTParams {
    thought: string;
    nextThoughtNeeded: boolean;
    thoughtNumber: number;
    totalThoughts: number;
    isRevision?: boolean;
    revisesThought?: number;
    branchFromThought?: number;
    branchId?: string;
    needsMoreThoughts?: boolean;
    score?: number;
    inputType?: string;
    problemStatus?: string;
    options?: string[];
    numberArray?: number[];
}

// Interface para descrições dos parâmetros de entrada
export interface InputDescriptions {
    [key: string]: string;
}

// Interface para resposta da ferramenta CoConuT
export interface CoConuTResponse {
    thoughtNumber: number;
    totalThoughts: number;
    nextThoughtNeeded: boolean;
    branches: string[];
    currentBranch: string;
    thoughtHistoryLength: number;
    hasCycle: boolean;
    reflexionPoints?: {
        isProblemBeingSolved: string;
        shouldIncreaseTotalThoughts: boolean;
        needsUserInput: boolean;
    };
    action?: string;
    inputType?: string;
    message?: string;
    options?: string[];
    error?: string;
    savedFiles?: SavedFileInfo[]; // Informações sobre arquivos salvos nesta operação
    inputDescriptions?: InputDescriptions; // Descrições dos parâmetros de entrada
}

// Esquema Zod para validação de parâmetros
export const CoConuTParamsSchema = z.object({
    thought: z.string().min(1, "O pensamento não pode estar vazio"),
    nextThoughtNeeded: z.boolean(),
    thoughtNumber: z.number().positive("O número do pensamento deve ser positivo"),
    totalThoughts: z.number().min(3, "Mínimo de 3 pensamentos necessários"),
    isRevision: z.boolean().optional(),
    revisesThought: z.number().positive().optional(),
    branchFromThought: z.number().positive().optional(),
    branchId: z.string().optional(),
    needsMoreThoughts: z.boolean().optional(),
    score: z.number().optional(),
    inputType: z.string().optional(),
    problemStatus: z.string().optional(),
    options: z.array(z.string()).optional(),
    numberArray: z.array(z.number()).optional()
});

// Interface para configuração do sistema
export interface CoConuTConfig {
    maxHistorySize: number;
    cycleDetectionThreshold: number;
    persistenceEnabled: boolean;
    maxBranches: number;
    reflectionInterval: number;
    projectPath?: string; // Caminho absoluto para o diretório do projeto
}

// Esquema Zod para validação de configuração
export const CoConuTConfigSchema = z.object({
    maxHistorySize: z.number().positive().default(1000),
    cycleDetectionThreshold: z.number().min(0).max(1).default(0.8),
    persistenceEnabled: z.boolean().default(false),
    maxBranches: z.number().positive().default(10),
    reflectionInterval: z.number().positive().default(3),
    projectPath: z.string().optional() // Validação para o caminho do projeto
});

// Configuração padrão
export const DEFAULT_CONFIG: CoConuTConfig = {
    maxHistorySize: 1000,
    cycleDetectionThreshold: 0.8,
    persistenceEnabled: false,
    maxBranches: 10,
    reflectionInterval: 3
}; 