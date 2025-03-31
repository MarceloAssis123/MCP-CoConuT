/**
 * Gerenciamento de ramificações de pensamento
 */

import { Logger } from './logger';
import { StorageProvider } from './storage';
import { CoConuTConfig } from './types';

/**
 * Classe para gerenciar ramificações de pensamento
 */
export class BranchManager {
    private branches: Record<string, Array<number>> = { 'main': [] };
    private currentBranch: string = 'main';
    private logger: Logger;
    private storageProvider: StorageProvider;
    private config: CoConuTConfig;

    constructor(storageProvider: StorageProvider, config: CoConuTConfig) {
        this.storageProvider = storageProvider;
        this.config = config;
        this.logger = Logger.getInstance();
    }

    /**
     * Inicializa o gerenciador de ramificações carregando dados do armazenamento
     */
    public async initialize(): Promise<void> {
        try {
            this.branches = await this.storageProvider.loadBranches();
            // Garantir que pelo menos a ramificação principal exista
            if (!this.branches['main']) {
                this.branches['main'] = [];
            }
            this.logger.info('Gerenciador de ramificações inicializado', {
                branchCount: Object.keys(this.branches).length
            });
        } catch (error) {
            this.logger.error('Erro ao inicializar gerenciador de ramificações', { error });
            this.branches = { 'main': [] };
        }
    }

    /**
     * Obtém a ramificação atual
     */
    public getCurrentBranch(): string {
        return this.currentBranch;
    }

    /**
     * Obtém todas as ramificações disponíveis
     */
    public getAllBranches(): string[] {
        return Object.keys(this.branches);
    }

    /**
     * Obtém os pensamentos associados a uma ramificação
     */
    public getBranchThoughts(branchId: string = this.currentBranch): number[] {
        return this.branches[branchId] || [];
    }

    /**
     * Cria uma nova ramificação a partir de um pensamento específico
     */
    public async createBranch(branchId: string, fromThought: number): Promise<boolean> {
        try {
            // Verificar se já existe uma ramificação com esse ID
            if (this.branches[branchId]) {
                this.logger.warn('Ramificação já existe', { branchId });
                return false;
            }

            // Verificar se atingimos o limite de ramificações
            if (Object.keys(this.branches).length >= this.config.maxBranches) {
                this.logger.warn('Limite de ramificações atingido', {
                    current: Object.keys(this.branches).length,
                    max: this.config.maxBranches
                });
                return false;
            }

            // Criar nova ramificação e inicializar com o pensamento de origem
            this.branches[branchId] = [fromThought];

            // Persistir alterações
            await this.storageProvider.saveBranches(this.branches);

            this.logger.info('Nova ramificação criada', { branchId, fromThought });
            return true;
        } catch (error) {
            this.logger.error('Erro ao criar ramificação', { error, branchId, fromThought });
            return false;
        }
    }

    /**
     * Muda para uma ramificação existente
     */
    public switchBranch(branchId: string): boolean {
        if (!this.branches[branchId]) {
            this.logger.warn('Tentativa de mudar para ramificação inexistente', { branchId });
            return false;
        }

        this.currentBranch = branchId;
        this.logger.info('Ramificação alterada', { branchId });
        return true;
    }

    /**
     * Adiciona um pensamento à ramificação atual
     */
    public async addThoughtToBranch(thoughtNumber: number, branchId: string = this.currentBranch): Promise<boolean> {
        try {
            if (!this.branches[branchId]) {
                this.logger.warn('Tentativa de adicionar pensamento a ramificação inexistente', { branchId });
                return false;
            }

            this.branches[branchId].push(thoughtNumber);

            // Persistir alterações
            await this.storageProvider.saveBranches(this.branches);

            this.logger.debug('Pensamento adicionado à ramificação', {
                thoughtNumber,
                branchId,
                branchSize: this.branches[branchId].length
            });
            return true;
        } catch (error) {
            this.logger.error('Erro ao adicionar pensamento à ramificação', {
                error,
                thoughtNumber,
                branchId
            });
            return false;
        }
    }

    /**
     * Funde duas ramificações
     */
    public async mergeBranches(sourceBranchId: string, targetBranchId: string = 'main'): Promise<boolean> {
        try {
            if (!this.branches[sourceBranchId] || !this.branches[targetBranchId]) {
                this.logger.warn('Tentativa de fundir ramificações inexistentes', {
                    sourceBranchId,
                    targetBranchId
                });
                return false;
            }

            // Adicionar pensamentos da ramificação de origem à ramificação de destino
            const uniqueThoughts = new Set([...this.branches[targetBranchId], ...this.branches[sourceBranchId]]);
            this.branches[targetBranchId] = Array.from(uniqueThoughts).sort((a, b) => a - b);

            // Se a ramificação atual for a de origem, mude para a de destino
            if (this.currentBranch === sourceBranchId) {
                this.currentBranch = targetBranchId;
            }

            // Remover a ramificação de origem
            delete this.branches[sourceBranchId];

            // Persistir alterações
            await this.storageProvider.saveBranches(this.branches);

            this.logger.info('Ramificações fundidas com sucesso', {
                sourceBranchId,
                targetBranchId,
                resultSize: this.branches[targetBranchId].length
            });
            return true;
        } catch (error) {
            this.logger.error('Erro ao fundir ramificações', {
                error,
                sourceBranchId,
                targetBranchId
            });
            return false;
        }
    }

    /**
     * Remove uma ramificação
     */
    public async removeBranch(branchId: string): Promise<boolean> {
        try {
            if (branchId === 'main') {
                this.logger.warn('Tentativa de remover ramificação principal', { branchId });
                return false;
            }

            if (!this.branches[branchId]) {
                this.logger.warn('Tentativa de remover ramificação inexistente', { branchId });
                return false;
            }

            // Se a ramificação atual for a que está sendo removida, mude para a principal
            if (this.currentBranch === branchId) {
                this.currentBranch = 'main';
            }

            // Remover a ramificação
            delete this.branches[branchId];

            // Persistir alterações
            await this.storageProvider.saveBranches(this.branches);

            this.logger.info('Ramificação removida com sucesso', { branchId });
            return true;
        } catch (error) {
            this.logger.error('Erro ao remover ramificação', { error, branchId });
            return false;
        }
    }

    /**
     * Limpa todas as ramificações exceto a principal
     */
    public async clearBranches(): Promise<boolean> {
        try {
            this.branches = { 'main': this.branches['main'] || [] };
            this.currentBranch = 'main';

            // Persistir alterações
            await this.storageProvider.saveBranches(this.branches);

            this.logger.info('Todas as ramificações foram removidas');
            return true;
        } catch (error) {
            this.logger.error('Erro ao limpar ramificações', { error });
            return false;
        }
    }
} 