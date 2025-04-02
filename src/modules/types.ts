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

// Interface para parâmetros da ferramenta CoConuT_Storage
export interface CoConuTStorageParams {
    projectPath: string;
    WhyChange: string;
    WhatChange: string;
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
    thought: z.string().min(1, "O pensamento não pode estar vazio")
        .describe("O texto do pensamento atual no processo de raciocínio"),
    nextThoughtNeeded: z.boolean()
        .describe("Indica se é necessário um próximo pensamento (true) ou se a cadeia está concluída (false)"),
    thoughtNumber: z.number().positive("O número do pensamento deve ser positivo")
        .describe("Número sequencial deste pensamento na cadeia"),
    totalThoughts: z.number().min(3, "Mínimo de 3 pensamentos necessários")
        .describe("Número total estimado de pensamentos para resolver o problema"),
    isRevision: z.boolean().optional()
        .describe("Indica se este pensamento revisa um pensamento anterior"),
    revisesThought: z.number().positive().optional()
        .describe("Número do pensamento que está sendo revisado"),
    branchFromThought: z.number().positive().optional()
        .describe("Número do pensamento a partir do qual esta ramificação começa"),
    branchId: z.string().optional()
        .describe("Identificador único da ramificação atual"),
    needsMoreThoughts: z.boolean().optional()
        .describe("Indica se o problema precisa de mais pensamentos do que o previsto inicialmente"),
    score: z.number().optional()
        .describe("Pontuação ou confiança associada a este pensamento (0-10)"),
    inputType: z.string().optional()
        .describe("Tipo de entrada esperada do usuário"),
    problemStatus: z.string().optional()
        .describe("Descrição do status atual da resolução do problema"),
    options: z.array(z.string()).optional()
        .describe("Lista de opções para o usuário escolher"),
    numberArray: z.array(z.number()).optional()
        .describe("Array de números fornecido como entrada")
});

// Esquema Zod para validação de parâmetros de CoConuT_Storage
export const CoConuTStorageParamsSchema = z.object({
    projectPath: z.string().min(1, "O caminho do projeto não pode estar vazio")
        .describe("Caminho absoluto para o diretório do projeto onde os arquivos serão salvos"),
    WhyChange: z.string().min(1, "O motivo da mudança não pode estar vazio")
        .describe("Explica por que a mudança foi necessária ou o que motivou a ação"),
    WhatChange: z.string().min(1, "A descrição da mudança não pode estar vazia")
        .describe("Descreve o que foi modificado ou implementado nesta ação")
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