/**
 * Fábrica central de componentes
 * Facilita a injeção de dependências e a criação de componentes
 */

import {
    IComponentFactory,
    ILogger,
    IStorageProvider,
    ICycleDetector,
    IInputManager,
    IBranchManager,
    IThoughtManager,
    IResponseFormatter
} from './interfaces';
import { Logger, LogLevel } from './logger';
import { StorageFactory } from './storage';
import { CycleDetectorFactory } from './cycle-detector';
import { InputFactory } from './input';
import { BranchManagerFactory } from './branch';
import { ThoughtManagerFactory } from './thought-manager';
import { FormatterFactory } from './formatters';
import { config } from '../config';
import { BranchManager } from './branch-manager';

/**
 * Implementação da fábrica de componentes
 */
export class ComponentFactory implements IComponentFactory {
    /**
     * Cria uma instância de logger
     */
    createLogger(options: {
        minLevel?: LogLevel;
        enableConsole?: boolean;
        includeTimestamp?: boolean;
        logFilePath?: string;
    } = {}): ILogger {
        const {
            minLevel = LogLevel[config.logging.minLevel.toUpperCase() as keyof typeof LogLevel],
            enableConsole = config.logging.enableConsole,
            includeTimestamp = config.logging.includeTimestamp,
            logFilePath = config.logging.logFilePath
        } = options;

        return Logger.getInstance({
            minLevel,
            enableConsole,
            includeTimestamp,
            logFilePath
        });
    }

    /**
     * Cria um provedor de armazenamento
     */
    createStorageProvider(options: {
        persistenceEnabled?: boolean;
    } = {}): IStorageProvider {
        const coconutConfig = {
            ...config.coconut,
            persistenceEnabled: options.persistenceEnabled ?? config.coconut.persistenceEnabled
        };

        return StorageFactory.createProvider(coconutConfig);
    }

    /**
     * Cria um detector de ciclos
     */
    createCycleDetector(options: {
        algorithm?: 'levenshtein' | 'jaccard' | 'cosine';
        threshold?: number;
        enableCache?: boolean;
        maxCacheSize?: number;
    } = {}): ICycleDetector {
        const {
            algorithm = config.coconut.similarityAlgorithm as 'levenshtein' | 'jaccard' | 'cosine',
            threshold = config.coconut.cycleDetectionThreshold
        } = options;

        return CycleDetectorFactory.createDetector({
            algorithm,
            threshold
        });
    }

    /**
     * Cria um gerenciador de input
     */
    createInputManager(options: any = {}): IInputManager {
        return InputFactory.createInputManager();
    }

    /**
     * Cria um gerenciador de ramificações
     */
    createBranchManager(storage: IStorageProvider, options: {
        maxBranches?: number;
    } = {}): IBranchManager {
        // Opções são passadas via config global
        return BranchManagerFactory.createBranchManager(storage);
    }

    /**
     * Cria um gerenciador de pensamentos
     */
    createThoughtManager(
        storage: IStorageProvider,
        branchManager: IBranchManager,
        cycleDetector: ICycleDetector,
        options: {
            maxHistorySize?: number;
            reflectionInterval?: number;
        } = {}
    ): IThoughtManager {
        const {
            maxHistorySize = config.coconut.maxHistorySize,
            reflectionInterval = config.coconut.reflectionInterval
        } = options;

        // Cast explícito como unknown e depois como BranchManager para forçar o TypeScript a aceitar
        return ThoughtManagerFactory.createThoughtManager(
            storage,
            branchManager as unknown as BranchManager,
            cycleDetector,
            {
                maxHistorySize,
                reflectionInterval
            }
        ) as IThoughtManager;
    }

    /**
     * Cria um formatador de resposta
     */
    createResponseFormatter(format: string = 'json'): IResponseFormatter {
        return FormatterFactory.createFormatter(format);
    }
}

/**
 * Singleton da fábrica de componentes
 */
export const componentFactory = new ComponentFactory(); 