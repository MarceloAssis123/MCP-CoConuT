/**
 * Gerenciamento avançado de ramificações (branches)
 * Permite manipular múltiplas linhas de pensamento, com comparação e mesclagem
 */

import { IBranchManager } from '../interfaces';
import { IStorageProvider } from '../interfaces';
import { Logger } from '../logger';
import { config } from '../../config';

/**
 * Implementação do gerenciador de ramificações
 */
export class BranchManager implements IBranchManager {
    private branches: Map<string, number[]>;
    private currentBranch: string;
    private storageProvider: IStorageProvider;
    private logger: Logger;
    private branchMetrics: Map<string, {
        thoughtCount: number;
        averageScore: number;
        hasCycles: boolean;
        divergencePoint?: number;
    }>;

    constructor(storageProvider: IStorageProvider) {
        this.branches = new Map();
        this.currentBranch = 'main';
        this.storageProvider = storageProvider;
        this.logger = Logger.getInstance();
        this.branchMetrics = new Map();

        // Inicializar com a ramificação principal
        this.branches.set('main', []);
    }

    /**
     * Inicializa o gerenciador de ramificações
     */
    async initialize(): Promise<void> {
        try {
            const loadedBranches = await this.storageProvider.loadBranches();

            // Converter para Map
            this.branches.clear();
            for (const [branchId, thoughtNumbers] of Object.entries(loadedBranches)) {
                this.branches.set(branchId, thoughtNumbers);
            }

            // Garantir que a ramificação 'main' existe
            if (!this.branches.has('main')) {
                this.branches.set('main', []);
            }

            // Verificar se o branch atual existe, se não, usar 'main'
            if (!this.branches.has(this.currentBranch)) {
                this.currentBranch = 'main';
            }

            this.logger.info('Gerenciador de ramificações inicializado', {
                branchCount: this.branches.size,
                currentBranch: this.currentBranch
            });
        } catch (error) {
            this.logger.error('Erro ao inicializar gerenciador de ramificações', { error });
            // Garantir estado mínimo em caso de erro
            this.branches.clear();
            this.branches.set('main', []);
            this.currentBranch = 'main';
        }
    }

    /**
     * Cria uma nova ramificação
     */
    async createBranch(branchId: string, fromThoughtNumber?: number): Promise<void> {
        if (this.branches.has(branchId)) {
            this.logger.warn(`Ramificação '${branchId}' já existe`);
            return;
        }

        // Verificar limite de ramificações
        if (this.branches.size >= config.coconut.maxBranches) {
            throw new Error(`Limite de ramificações atingido (${config.coconut.maxBranches})`);
        }

        // Obter pensamentos da ramificação atual até o ponto de bifurcação
        const currentBranchThoughts = this.branches.get(this.currentBranch) || [];
        let newBranchThoughts: number[] = [];

        if (fromThoughtNumber !== undefined) {
            // Encontrar o índice do pensamento na ramificação atual
            const fromIndex = currentBranchThoughts.findIndex(t => t === fromThoughtNumber);

            if (fromIndex >= 0) {
                // Copiar pensamentos até o ponto de bifurcação (inclusive)
                newBranchThoughts = currentBranchThoughts.slice(0, fromIndex + 1);
            } else {
                // Pensamento de origem não encontrado, criar ramificação vazia
                this.logger.warn(`Pensamento ${fromThoughtNumber} não encontrado na ramificação atual`);
            }
        }

        // Criar nova ramificação
        this.branches.set(branchId, newBranchThoughts);

        // Registrar ponto de divergência para métricas
        this.updateBranchMetrics(branchId, {
            thoughtCount: newBranchThoughts.length,
            averageScore: 0,
            hasCycles: false,
            divergencePoint: fromThoughtNumber
        });

        // Persistir alterações
        await this.storageProvider.saveBranch(branchId, newBranchThoughts);

        this.logger.info(`Ramificação '${branchId}' criada`, {
            fromThought: fromThoughtNumber,
            thoughtCount: newBranchThoughts.length
        });
    }

    /**
     * Alterna para uma ramificação específica
     */
    switchBranch(branchId: string): void {
        if (!this.branches.has(branchId)) {
            throw new Error(`Ramificação '${branchId}' não existe`);
        }

        this.currentBranch = branchId;

        this.logger.info(`Alterado para ramificação '${branchId}'`, {
            thoughtCount: this.branches.get(branchId)!.length
        });
    }

    /**
     * Obtém todas as ramificações disponíveis
     */
    getAllBranches(): string[] {
        return Array.from(this.branches.keys());
    }

    /**
     * Obtém a ramificação atual
     */
    getCurrentBranch(): string {
        return this.currentBranch;
    }

    /**
     * Obtém os pensamentos de uma ramificação específica
     */
    getBranchThoughts(branchId?: string): number[] {
        const targetBranch = branchId || this.currentBranch;
        return [...(this.branches.get(targetBranch) || [])];
    }

    /**
     * Adiciona um pensamento à ramificação atual
     */
    async addThoughtToBranch(thoughtNumber: number, branchId?: string): Promise<void> {
        const targetBranch = branchId || this.currentBranch;

        if (!this.branches.has(targetBranch)) {
            throw new Error(`Ramificação '${targetBranch}' não existe`);
        }

        const thoughts = this.branches.get(targetBranch)!;

        // Verificar se o pensamento já existe na ramificação
        if (thoughts.includes(thoughtNumber)) {
            // Atualizar métricas para indicar que temos um ciclo
            const metrics = this.getBranchMetrics(targetBranch);
            metrics.hasCycles = true;
            this.updateBranchMetrics(targetBranch, metrics);

            this.logger.warn(`Pensamento ${thoughtNumber} já existe na ramificação '${targetBranch}'`);
            return;
        }

        // Adicionar pensamento
        thoughts.push(thoughtNumber);

        // Atualizar métricas
        const metrics = this.getBranchMetrics(targetBranch);
        metrics.thoughtCount = thoughts.length;
        this.updateBranchMetrics(targetBranch, metrics);

        // Persistir alterações
        await this.storageProvider.saveBranch(targetBranch, thoughts);

        this.logger.info(`Pensamento ${thoughtNumber} adicionado à ramificação '${targetBranch}'`);
    }

    /**
     * Mescla duas ramificações
     */
    async mergeBranches(sourceBranchId: string, targetBranchId: string): Promise<void> {
        if (!this.branches.has(sourceBranchId)) {
            throw new Error(`Ramificação de origem '${sourceBranchId}' não existe`);
        }

        if (!this.branches.has(targetBranchId)) {
            throw new Error(`Ramificação de destino '${targetBranchId}' não existe`);
        }

        const sourceThoughts = this.branches.get(sourceBranchId)!;
        const targetThoughts = this.branches.get(targetBranchId)!;

        // Encontrar o ponto comum mais recente
        const comparison = this.compareBranches(sourceBranchId, targetBranchId);

        // Se não houver pontos em comum, não é possível mesclar
        if (comparison.common.length === 0) {
            throw new Error('Ramificações não têm pontos em comum para mesclar');
        }

        // Pensamentos exclusivos da origem que serão adicionados ao destino
        const uniqueSourceThoughts = comparison.onlyInBranch1;

        // Criar nova lista de pensamentos para o destino
        const mergedThoughts = [...targetThoughts];

        // Adicionar pensamentos exclusivos da origem
        for (const thought of uniqueSourceThoughts) {
            if (!mergedThoughts.includes(thought)) {
                mergedThoughts.push(thought);
            }
        }

        // Ordenar por número de pensamento (assumindo que é crescente)
        mergedThoughts.sort((a, b) => a - b);

        // Atualizar ramificação de destino
        this.branches.set(targetBranchId, mergedThoughts);

        // Atualizar métricas
        const metrics = this.getBranchMetrics(targetBranchId);
        metrics.thoughtCount = mergedThoughts.length;
        this.updateBranchMetrics(targetBranchId, metrics);

        // Persistir alterações
        await this.storageProvider.saveBranch(targetBranchId, mergedThoughts);

        this.logger.info(`Ramificações mescladas: '${sourceBranchId}' -> '${targetBranchId}'`, {
            addedThoughts: uniqueSourceThoughts.length,
            totalThoughts: mergedThoughts.length
        });
    }

    /**
     * Compara duas ramificações para identificar pensamentos comuns e exclusivos
     */
    compareBranches(branchId1: string, branchId2: string): {
        common: number[];
        onlyInBranch1: number[];
        onlyInBranch2: number[];
    } {
        if (!this.branches.has(branchId1)) {
            throw new Error(`Ramificação '${branchId1}' não existe`);
        }

        if (!this.branches.has(branchId2)) {
            throw new Error(`Ramificação '${branchId2}' não existe`);
        }

        const thoughts1 = this.branches.get(branchId1)!;
        const thoughts2 = this.branches.get(branchId2)!;

        // Pensamentos comuns
        const common = thoughts1.filter(t => thoughts2.includes(t));

        // Pensamentos exclusivos da primeira ramificação
        const onlyInBranch1 = thoughts1.filter(t => !thoughts2.includes(t));

        // Pensamentos exclusivos da segunda ramificação
        const onlyInBranch2 = thoughts2.filter(t => !thoughts1.includes(t));

        return {
            common,
            onlyInBranch1,
            onlyInBranch2
        };
    }

    /**
     * Obtém métricas para uma ramificação
     */
    getBranchMetrics(branchId: string): {
        thoughtCount: number;
        averageScore: number;
        hasCycles: boolean;
        divergencePoint?: number;
    } {
        if (!this.branches.has(branchId)) {
            throw new Error(`Ramificação '${branchId}' não existe`);
        }

        // Criar métricas padrão se não existirem
        if (!this.branchMetrics.has(branchId)) {
            this.branchMetrics.set(branchId, {
                thoughtCount: this.branches.get(branchId)!.length,
                averageScore: 0,
                hasCycles: false
            });
        }

        return this.branchMetrics.get(branchId)!;
    }

    /**
     * Atualiza métricas para uma ramificação
     */
    private updateBranchMetrics(branchId: string, metrics: {
        thoughtCount: number;
        averageScore: number;
        hasCycles: boolean;
        divergencePoint?: number;
    }): void {
        this.branchMetrics.set(branchId, { ...metrics });
    }

    /**
     * Atualiza a pontuação média de uma ramificação
     */
    updateBranchScore(branchId: string, score: number): void {
        const metrics = this.getBranchMetrics(branchId);

        // Atualizar média ponderada
        const oldWeight = metrics.thoughtCount - 1;
        const newAverage = oldWeight > 0
            ? (metrics.averageScore * oldWeight + score) / metrics.thoughtCount
            : score;

        metrics.averageScore = newAverage;

        this.updateBranchMetrics(branchId, metrics);
    }

    /**
     * Remove uma ramificação
     */
    async removeBranch(branchId: string): Promise<boolean> {
        if (branchId === 'main') {
            throw new Error('Não é possível remover a ramificação principal');
        }

        if (!this.branches.has(branchId)) {
            this.logger.warn(`Tentativa de remover ramificação inexistente: ${branchId}`);
            return false;
        }

        // Se for a ramificação atual, mudar para 'main'
        if (this.currentBranch === branchId) {
            this.currentBranch = 'main';
        }

        // Remover a ramificação
        this.branches.delete(branchId);
        this.branchMetrics.delete(branchId);

        // Persistir alterações (remover do armazenamento)
        try {
            await this.storageProvider.saveBranch(branchId, []);
            this.logger.info(`Ramificação '${branchId}' removida`);
            return true;
        } catch (error) {
            this.logger.error(`Erro ao remover ramificação '${branchId}'`, { error });
            return false;
        }
    }

    /**
     * Remove todos os pensamentos de uma ramificação
     */
    async clearBranchThoughts(branchId: string): Promise<boolean> {
        if (!this.branches.has(branchId)) {
            this.logger.warn(`Tentativa de limpar ramificação inexistente: ${branchId}`);
            return false;
        }

        // Limpar pensamentos
        this.branches.set(branchId, []);

        // Atualizar métricas
        this.updateBranchMetrics(branchId, {
            thoughtCount: 0,
            averageScore: 0,
            hasCycles: false
        });

        // Persistir alterações
        try {
            await this.storageProvider.saveBranch(branchId, []);
            this.logger.info(`Pensamentos da ramificação '${branchId}' removidos`);
            return true;
        } catch (error) {
            this.logger.error(`Erro ao limpar pensamentos da ramificação '${branchId}'`, { error });
            return false;
        }
    }

    /**
     * Limpa todas as ramificações
     */
    async clearBranches(): Promise<boolean> {
        try {
            // Redefinir as ramificações para apenas a principal
            this.branches.clear();
            this.branches.set('main', []);
            this.currentBranch = 'main';

            // Persistir alterações
            await this.storageProvider.saveBranch('main', []);

            this.logger.info('Todas as ramificações foram removidas');
            return true;
        } catch (error) {
            this.logger.error('Erro ao limpar ramificações', { error });
            return false;
        }
    }
}

/**
 * Fábrica para criar gerenciadores de ramificações
 */
export class BranchManagerFactory {
    /**
     * Cria um gerenciador de ramificações
     */
    static createBranchManager(storageProvider: IStorageProvider): IBranchManager {
        return new BranchManager(storageProvider);
    }
} 