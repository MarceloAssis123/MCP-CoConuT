/**
 * Interfaces centrais para injeção de dependências
 * Permite desacoplar componentes e facilitar testes
 */

import { ThoughtEntry, SavedFileInfo } from './types';

/**
 * Interface para serviço de log
 */
export interface ILogger {
    debug(message: string, meta?: Record<string, any>): void;
    info(message: string, meta?: Record<string, any>): void;
    warn(message: string, meta?: Record<string, any>): void;
    error(message: string, meta?: Record<string, any>): void;
}

/**
 * Interface para dados armazenados pelo provedor
 */
export interface StorageData {
    thoughts: ThoughtEntry[];
    branches: Record<string, number[]>;
}

/**
 * Interface para provedores de armazenamento
 */
export interface IStorageProvider {
    initialize(): Promise<void>;
    saveThought(thought: ThoughtEntry): Promise<SavedFileInfo | null>;
    loadHistory(): Promise<ThoughtEntry[]>;
    saveBranch(branchId: string, thoughtNumbers: number[]): Promise<SavedFileInfo | null>;
    loadBranches(): Promise<Record<string, number[]>>;
    clear(): Promise<void>;

    // Métodos de exportação e importação de dados
    exportData(): Promise<StorageData>;
    importData(data: StorageData): Promise<void>;
}

/**
 * Interface para serviço de detecção de ciclos
 */
export interface ICycleDetector {
    detectCycles(thoughts: string[], newThought: string): boolean;
    calculateSimilarity(a: string, b: string): number;
}

/**
 * Interface para eventos de input
 */
export interface InputEvent<T> {
    type: string;
    data: T;
    timestamp: number;
    processed: boolean;
}

/**
 * Interface para assinantes de eventos de input
 */
export interface InputSubscriber<T> {
    onInput(event: InputEvent<T>): void;
}

/**
 * Interface para gerenciador de input
 */
export interface IInputManager {
    subscribe<T>(type: string, subscriber: InputSubscriber<T>): void;
    unsubscribe<T>(type: string, subscriber: InputSubscriber<T>): void;
    publish<T>(type: string, data: T): boolean;
    requestInput(type: string, message: string, options?: any[]): void;
    isInputRequired(): boolean;
    getCurrentInputType(): string;
}

/**
 * Interface para gerenciador de ramificações
 */
export interface IBranchManager {
    initialize(): Promise<void>;
    createBranch(branchId: string, fromThoughtNumber?: number): Promise<SavedFileInfo | null>;
    switchBranch(branchId: string): void;
    getAllBranches(): string[];
    getCurrentBranch(): string;
    getBranchThoughts(branchId?: string): number[];
    addThoughtToBranch(thoughtNumber: number, branchId?: string): Promise<SavedFileInfo | null>;
    mergeBranches(sourceBranchId: string, targetBranchId: string): Promise<SavedFileInfo | null>;
    compareBranches(branchId1: string, branchId2: string): {
        common: number[];
        onlyInBranch1: number[];
        onlyInBranch2: number[];
    };
    getBranchMetrics(branchId: string): {
        thoughtCount: number;
        averageScore: number;
        hasCycles: boolean;
        divergencePoint?: number;
    };
    clearBranches(): Promise<boolean>;
}

/**
 * Interface para gerenciador de pensamentos
 */
export interface IThoughtManager {
    initialize(): Promise<void>;
    addThought(
        thought: string,
        thoughtNumber: number,
        isRevision?: boolean,
        revisesThought?: number,
        score?: number,
        metadata?: Record<string, any>
    ): Promise<SavedFileInfo | null>;
    getThoughtHistory(): ThoughtEntry[];
    getThoughtsForBranch(branchId?: string): ThoughtEntry[];
    getThoughtsAsStrings(branchId?: string): string[];
    detectCycle(newThought: string, branchId?: string): boolean;
    setProblemStatus(status: string): void;
    getProblemStatus(): string;
    generateReflectionPoints(currentThought: number, totalThoughts: number): {
        isProblemBeingSolved: string;
        shouldIncreaseTotalThoughts: boolean;
        needsUserInput: boolean;
    } | null;
}

/**
 * Interface para formatadores de resposta
 */
export interface IResponseFormatter {
    format(response: any): {
        type: string;
        text: string;
    };
}

/**
 * Interface para o analisador CoConuT
 */
export interface ICoConuTAnalyser {
    analyseChainOfThought(thoughts: ThoughtEntry[]): {
        isOnRightTrack: boolean;
        needsMoreUserInfo: boolean;
        suggestedTotalThoughts: number;
        userInfoNeeded?: string[];
        suggestions?: string[];
    };
}

/**
 * Fábrica para criação de componentes
 */
export interface IComponentFactory {
    createLogger(options?: any): ILogger;
    createStorageProvider(options?: any): IStorageProvider;
    createCycleDetector(options?: any): ICycleDetector;
    createInputManager(options?: any): IInputManager;
    createBranchManager(storage: IStorageProvider, options?: any): IBranchManager;
    createThoughtManager(
        storage: IStorageProvider,
        branchManager: IBranchManager,
        cycleDetector: ICycleDetector,
        options?: any
    ): IThoughtManager;
    createResponseFormatter(format: string): IResponseFormatter;
    createCoConuTAnalyser(options?: any): ICoConuTAnalyser;
} 