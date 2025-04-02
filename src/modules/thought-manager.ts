/**
 * Gerenciamento de pensamentos para CoConuT
 */

import { ThoughtEntry, CoConuTConfig, SavedFileInfo } from './types';
import { Logger } from './logger';
import { StorageProvider } from './storage';
import { CycleDetector, CycleDetectorFactory } from './cycle-detector';
import { BranchManager } from './branch-manager';
import { IStorageProvider, IBranchManager, ICycleDetector } from './interfaces';

/**
 * Classe para gerenciar pensamentos
 */
export class ThoughtManager {
    private thoughtHistory: ThoughtEntry[] = [];
    private interactionCount: number = 0;
    private lastProblemStatus: string = '';
    private logger: Logger;
    private storageProvider: StorageProvider;
    private cycleDetector: CycleDetector;
    private branchManager: BranchManager;
    private config: CoConuTConfig;

    constructor(
        storageProvider: StorageProvider,
        branchManager: BranchManager,
        config: CoConuTConfig
    ) {
        this.storageProvider = storageProvider;
        this.branchManager = branchManager;
        this.config = config;
        this.logger = Logger.getInstance();
        this.cycleDetector = CycleDetectorFactory.createDetector({
            threshold: config.cycleDetectionThreshold
        });
    }

    /**
     * Inicializa o gerenciador de pensamentos carregando dados do armazenamento
     */
    public async initialize(): Promise<void> {
        try {
            this.thoughtHistory = await this.storageProvider.loadHistory();
            this.interactionCount = this.thoughtHistory.length;

            this.logger.info('Gerenciador de pensamentos inicializado', {
                thoughtCount: this.thoughtHistory.length
            });
        } catch (error: any) {
            this.logger.error('Erro ao inicializar gerenciador de pensamentos', { error });
            this.thoughtHistory = [];
        }
    }

    /**
     * Adiciona um novo pensamento ao histórico
     * @returns Informações sobre o arquivo salvo e a entrada do pensamento
     */
    public async addThought(
        thought: string,
        thoughtNumber: number,
        isRevision: boolean = false,
        revisesThought?: number,
        score: number = 0,
        metadata: Record<string, any> = {}
    ): Promise<SavedFileInfo | null> {
        try {
            this.interactionCount++;

            const currentBranch = this.branchManager.getCurrentBranch();

            // Criar entrada de pensamento
            const thoughtEntry: ThoughtEntry = {
                thought,
                thoughtNumber,
                branchId: currentBranch,
                score,
                timestamp: Date.now(),
                metadata
            };

            if (isRevision && revisesThought) {
                // Atualizar um pensamento existente em vez de adicionar novo
                const index = this.thoughtHistory.findIndex(t =>
                    t.thoughtNumber === revisesThought && t.branchId === currentBranch
                );

                if (index >= 0) {
                    this.thoughtHistory[index] = thoughtEntry;
                    this.logger.info('Pensamento revisado', {
                        thoughtNumber,
                        revisesThought,
                        branchId: currentBranch
                    });
                } else {
                    this.thoughtHistory.push(thoughtEntry);
                    this.logger.warn('Tentativa de revisar pensamento inexistente, adicionado como novo', {
                        thoughtNumber,
                        revisesThought,
                        branchId: currentBranch
                    });
                }
            } else {
                // Adicionar novo pensamento
                this.thoughtHistory.push(thoughtEntry);

                // Adicionar à ramificação atual
                await this.branchManager.addThoughtToBranch(thoughtNumber);

                this.logger.info('Novo pensamento adicionado', {
                    thoughtNumber,
                    branchId: currentBranch
                });
            }

            // Persistir o pensamento e obter informações do arquivo
            const savedFileInfo = await this.storageProvider.saveThought(thoughtEntry);

            // Limitar tamanho do histórico em memória se necessário
            this.enforceHistorySizeLimit();

            return savedFileInfo;
        } catch (error: any) {
            this.logger.error('Erro ao adicionar pensamento', {
                error,
                thoughtNumber,
                isRevision
            });
            throw new Error(`Falha ao adicionar pensamento: ${error.message}`);
        }
    }

    /**
     * Atualiza o status do problema
     */
    public setProblemStatus(status: string): void {
        this.lastProblemStatus = status;
        this.logger.info('Status do problema atualizado', { status });
    }

    /**
     * Obtém o status atual do problema
     */
    public getProblemStatus(): string {
        return this.lastProblemStatus;
    }

    /**
     * Obtém o histórico de pensamentos
     */
    public getThoughtHistory(): ThoughtEntry[] {
        return [...this.thoughtHistory];
    }

    /**
     * Obtém o histórico de pensamentos para uma ramificação específica
     */
    public getThoughtsForBranch(branchId: string = this.branchManager.getCurrentBranch()): ThoughtEntry[] {
        return this.thoughtHistory.filter(t => t.branchId === branchId);
    }

    /**
     * Obtém pensamentos como texto para uma ramificação específica
     */
    public getThoughtsAsStrings(branchId: string = this.branchManager.getCurrentBranch()): string[] {
        return this.getThoughtsForBranch(branchId).map(t => t.thought);
    }

    /**
     * Verifica se um novo pensamento forma um ciclo com os anteriores
     */
    public detectCycle(newThought: string, branchId: string = this.branchManager.getCurrentBranch()): boolean {
        const thoughts = this.getThoughtsAsStrings(branchId);
        return this.cycleDetector.detectCycles(thoughts, newThought);
    }

    /**
     * Obtém o número da interação atual
     */
    public getInteractionCount(): number {
        return this.interactionCount;
    }

    /**
     * Obtém um pensamento específico
     */
    public getThought(thoughtNumber: number, branchId: string = this.branchManager.getCurrentBranch()): ThoughtEntry | null {
        const thought = this.thoughtHistory.find(t =>
            t.thoughtNumber === thoughtNumber && t.branchId === branchId
        );

        return thought || null;
    }

    /**
     * Remove todos os pensamentos para uma ramificação específica
     */
    public async clearThoughtsForBranch(branchId: string): Promise<boolean> {
        try {
            // Remover pensamentos da ramificação do histórico em memória
            this.thoughtHistory = this.thoughtHistory.filter(t => t.branchId !== branchId);

            // Persistir alterações (reescrever todo o histórico)
            for (const thought of this.thoughtHistory) {
                await this.storageProvider.saveThought(thought);
            }

            this.logger.info('Pensamentos removidos para ramificação', { branchId });
            return true;
        } catch (error: any) {
            this.logger.error('Erro ao remover pensamentos para ramificação', {
                error,
                branchId
            });
            return false;
        }
    }

    /**
     * Avalia se é necessário solicitar input do usuário com base no progresso
     */
    public shouldRequestUserInput(thoughtNumber: number, totalThoughts: number): boolean {
        // Solicitar input se detectar ciclo ou estiver próximo do fim
        const hasCycle = this.detectCycle('', this.branchManager.getCurrentBranch());
        const isNearEnd = thoughtNumber >= totalThoughts * 0.8;

        return hasCycle || isNearEnd;
    }

    /**
     * Avalia se é necessário aumentar o número total de pensamentos
     */
    public shouldIncreaseTotalThoughts(thoughtNumber: number, totalThoughts: number): boolean {
        // Sugere aumentar se já usou 70% dos pensamentos previstos
        return thoughtNumber >= totalThoughts * 0.7;
    }

    /**
     * Gerar pontos de reflexão periódicos
     */
    public generateReflectionPoints(thoughtNumber: number, totalThoughts: number): {
        isProblemBeingSolved: string;
        shouldIncreaseTotalThoughts: boolean;
        needsUserInput: boolean;
    } | null {
        // Gerar reflexão a cada N interações, conforme configurado
        if (this.interactionCount % this.config.reflectionInterval === 0) {
            return {
                isProblemBeingSolved: this.lastProblemStatus || "Não foi fornecido status do problema ainda",
                shouldIncreaseTotalThoughts: this.shouldIncreaseTotalThoughts(thoughtNumber, totalThoughts),
                needsUserInput: this.shouldRequestUserInput(thoughtNumber, totalThoughts)
            };
        }

        return null;
    }

    /**
     * Limita o tamanho do histórico em memória conforme configuração
     */
    private enforceHistorySizeLimit(): void {
        if (this.thoughtHistory.length > this.config.maxHistorySize) {
            // Manter apenas os pensamentos mais recentes
            this.thoughtHistory = this.thoughtHistory.slice(-this.config.maxHistorySize);
            this.logger.info('Histórico de pensamentos limitado pelo tamanho máximo', {
                maxSize: this.config.maxHistorySize
            });
        }
    }

    /**
     * Cria uma instância de gerenciador de pensamentos
     */
    public static createThoughtManager(
        storageProvider: StorageProvider | IStorageProvider,
        branchManager: BranchManager | IBranchManager,
        cycleDetector: CycleDetector | ICycleDetector,
        options: {
            maxHistorySize?: number;
            reflectionInterval?: number;
        } = {}
    ): ThoughtManager {
        const config: CoConuTConfig = {
            maxHistorySize: options.maxHistorySize || 1000,
            cycleDetectionThreshold: 0.8,
            persistenceEnabled: false,
            maxBranches: 10,
            reflectionInterval: options.reflectionInterval || 3
        };

        // Forçando a conversão para os tipos específicos, assumindo que a implementação é compatível
        return new ThoughtManager(
            storageProvider as StorageProvider,
            branchManager as BranchManager,
            config
        );
    }
}

/**
 * Fábrica para criar gerenciadores de pensamentos
 */
export class ThoughtManagerFactory {
    /**
     * Cria uma instância de gerenciador de pensamentos
     */
    public static createThoughtManager(
        storageProvider: StorageProvider,
        branchManager: BranchManager,
        cycleDetector: CycleDetector,
        options: {
            maxHistorySize?: number;
            reflectionInterval?: number;
        } = {}
    ): ThoughtManager {
        return ThoughtManager.createThoughtManager(
            storageProvider,
            branchManager,
            cycleDetector,
            options
        );
    }
} 