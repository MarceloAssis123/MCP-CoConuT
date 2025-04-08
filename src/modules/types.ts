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
    /**
     * Quando definido como `true`, força a execução do analisador CoConuT_Analyser
     * imediatamente, independentemente de outras condições.
     * 
     * Use este parâmetro quando:
     * 1. Quiser verificar se o raciocínio está no caminho correto em qualquer ponto
     * 2. Suspeitar que pode estar ocorrendo desvio do objetivo original
     * 3. Precisar decidir se o número de pensamentos estimado é suficiente
     * 4. Quiser checar se são necessárias mais informações do usuário
     * 
     * A análise também é executada automaticamente em determinados pontos:
     * - Em intervalos regulares de interações
     * - Na detecção de ciclos
     * - Na criação de ramificações
     * - No último pensamento da cadeia
     * - Quando o score for baixo
     * - Em marcos significativos do processo de pensamento
     */
    Call_CoConuT_Analyser?: boolean;
}

// Interface para parâmetros da ferramenta CoConuT_Storage
export interface CoConuTStorageParams {
    projectPath: string;
    WhyChange: string;
    WhatChange: string;
    category?: string;
    subCategories?: string[];
    tags?: string[];
    impactLevel?: 'low' | 'medium' | 'high';
    affectedFiles?: string[];
    codeSnippets?: Array<{ before: string, after: string, file: string }>;
    relatedConclusions?: string[];
    ticketReference?: string;
    businessContext?: string;
    alternativesConsidered?: string[];
    testingPerformed?: string;
    technicalContext?: string;
}

// Interface para descrições dos parâmetros de entrada
export interface InputDescriptions {
    [key: string]: string;
}

// Interface for CoConuT tool response
export interface CoConuTResponse {
    // Essential fields for thought flow control
    thoughtNumber: number;
    totalThoughts: number;
    nextThoughtNeeded: boolean;

    // Fields for action and interaction control
    action?: string;
    inputType?: string;
    message?: string;
    options?: string[];

    // Error handling
    error?: string;

    // Thought chain analysis (always present)
    analysis: {
        isOnRightTrack: boolean;
        needsMoreUserInfo: boolean;
        suggestedTotalThoughts: number;
        userInfoNeeded?: string[];
        suggestions?: string[];
    };
}

// Zod schema for parameter validation
export const CoConuTParamsSchema = z.object({
    thought: z.string().min(1, "Thought cannot be empty")
        .describe("The current thought text in the reasoning process"),
    nextThoughtNeeded: z.boolean()
        .describe("Indicates if a next thought is needed (true) or if the chain is complete (false)"),
    thoughtNumber: z.number().positive("Thought number must be positive")
        .describe("Sequential number of this thought in the chain"),
    totalThoughts: z.number().min(3, "Minimum of 3 thoughts required")
        .describe("Total estimated number of thoughts to solve the problem (minimum of 3 required)"),
    isRevision: z.boolean().optional()
        .describe("Indicates if this thought revises a previous thought"),
    revisesThought: z.number().positive().optional()
        .describe("Number of the thought being revised"),
    branchFromThought: z.number().positive().optional()
        .describe("Number of the thought from which this branch starts"),
    branchId: z.string().optional()
        .describe("Unique identifier of the current branch"),
    needsMoreThoughts: z.boolean().optional()
        .describe("Indicates if the problem needs more thoughts than initially estimated"),
    score: z.number().optional()
        .describe("Score or confidence associated with this thought (0-10)"),
    inputType: z.string().optional()
        .describe("Type of input expected from the user"),
    problemStatus: z.string().optional()
        .describe("Description of the current status of problem solving"),
    options: z.array(z.string()).optional()
        .describe("List of options for the user to choose from"),
    numberArray: z.array(z.number()).optional()
        .describe("Array of numbers provided as input"),
    Call_CoConuT_Analyser: z.boolean().optional()
        .describe("Indicates if the CoConuT_Analyser should be called")
});

// Zod schema for CoConuT_Storage parameter validation
export const CoConuTStorageParamsSchema = z.object({
    projectPath: z.string().min(1, "Project path cannot be empty")
        .describe("Absolute path to the project directory where files will be saved. This path will be used to create the necessary directory structure for storing thought chains, conclusions, and interaction history."),
    WhyChange: z.string().min(1, "Reason for change cannot be empty")
        .describe("Explains why the change was necessary or what motivated the action. This text will be included in the conclusion file and helps provide context for future reference."),
    WhatChange: z.string().min(1, "Change description cannot be empty")
        .describe("Describes what was modified or implemented in this action. This text will be included in the conclusion file and provides a clear summary of the changes made."),
    category: z.string().optional()
        .describe("Main category of the change (feature, bugfix, refactoring, documentation, etc.) for better classification and retrieval."),
    subCategories: z.array(z.string()).optional()
        .describe("Subcategories for more specific classification (UI, performance, security, etc.)."),
    tags: z.array(z.string()).optional()
        .describe("Tags for improved search and classification of changes."),
    impactLevel: z.enum(['low', 'medium', 'high']).optional()
        .describe("Level of impact this change has on the system."),
    affectedFiles: z.array(z.string()).optional()
        .describe("List of files affected by this change for better context."),
    codeSnippets: z.array(z.object({
        before: z.string(),
        after: z.string(),
        file: z.string()
    })).optional()
        .describe("Relevant code snippets showing the changes made."),
    relatedConclusions: z.array(z.string()).optional()
        .describe("IDs of related conclusions to establish connections between changes."),
    ticketReference: z.string().optional()
        .describe("Reference to a ticket/issue in a tracking system (JIRA, GitHub Issues)."),
    businessContext: z.string().optional()
        .describe("Business context explaining the value or strategic motivation for the change."),
    alternativesConsidered: z.array(z.string()).optional()
        .describe("Alternatives that were considered and reasons they were rejected."),
    testingPerformed: z.string().optional()
        .describe("Description of tests performed to validate the change."),
    technicalContext: z.string().optional()
        .describe("Additional technical context about the architecture or components affected.")
});

// System configuration interface
export interface CoConuTConfig {
    maxHistorySize: number;
    cycleDetectionThreshold: number;
    persistenceEnabled: boolean;
    maxBranches: number;
    reflectionInterval: number;
    projectPath?: string; // Absolute path to the project directory
}

// Zod schema for configuration validation
export const CoConuTConfigSchema = z.object({
    maxHistorySize: z.number().positive().default(1000),
    cycleDetectionThreshold: z.number().min(0).max(1).default(0.8),
    persistenceEnabled: z.boolean().default(false),
    maxBranches: z.number().positive().default(10),
    reflectionInterval: z.number().positive().default(3),
    projectPath: z.string().optional() // Validation for project path
});

// Default configuration
export const DEFAULT_CONFIG: CoConuTConfig = {
    maxHistorySize: 1000,
    cycleDetectionThreshold: 0.8,
    persistenceEnabled: false,
    maxBranches: 10,
    reflectionInterval: 3
}; 