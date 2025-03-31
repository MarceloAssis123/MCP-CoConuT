/**
 * Sistema de persistência para histórico de pensamentos
 */

import * as fs from 'fs';
import * as path from 'path';
import { ThoughtEntry, CoConuTConfig } from './types';
import { Logger } from './logger';

/**
 * Interface para diferentes tipos de armazenamento
 */
export interface StorageProvider {
    saveThought(entry: ThoughtEntry): Promise<void>;
    loadHistory(): Promise<ThoughtEntry[]>;
    saveBranches(branches: Record<string, Array<number>>): Promise<void>;
    loadBranches(): Promise<Record<string, Array<number>>>;
    clear(): Promise<void>;
}

/**
 * Implementação de armazenamento em arquivo
 */
export class FileStorageProvider implements StorageProvider {
    private filePath: string;
    private branchesFilePath: string;
    private logger: Logger;

    constructor(config: CoConuTConfig) {
        const basePath = config.storageFilePath || './coconut-data';
        this.filePath = path.resolve(basePath, 'thought-history.json');
        this.branchesFilePath = path.resolve(basePath, 'branches.json');
        this.logger = Logger.getInstance();

        // Garantir que o diretório existe
        const dirPath = path.dirname(this.filePath);
        if (!fs.existsSync(dirPath)) {
            try {
                fs.mkdirSync(dirPath, { recursive: true });
            } catch (error: any) {
                this.logger.error('Falha ao criar diretório de armazenamento', { error, dirPath });
            }
        }
    }

    /**
     * Salva um pensamento no armazenamento
     */
    public async saveThought(entry: ThoughtEntry): Promise<void> {
        try {
            // Carregar histórico existente
            const history = await this.loadHistory();

            // Verificar se é uma revisão
            const index = history.findIndex(t =>
                t.thoughtNumber === entry.thoughtNumber && t.branchId === entry.branchId
            );

            if (index >= 0) {
                // Atualizar pensamento existente
                history[index] = entry;
            } else {
                // Adicionar novo pensamento
                history.push(entry);
            }

            // Salvar histórico atualizado
            await fs.promises.writeFile(this.filePath, JSON.stringify(history, null, 2));
            this.logger.debug('Pensamento salvo com sucesso', { entry });
        } catch (error: any) {
            this.logger.error('Erro ao salvar pensamento', { error, entry });
            throw new Error(`Falha ao salvar pensamento: ${error?.message || 'Erro desconhecido'}`);
        }
    }

    /**
     * Carrega o histórico completo de pensamentos
     */
    public async loadHistory(): Promise<ThoughtEntry[]> {
        try {
            if (!fs.existsSync(this.filePath)) {
                return [];
            }

            const data = await fs.promises.readFile(this.filePath, 'utf-8');
            const history: ThoughtEntry[] = JSON.parse(data);
            this.logger.debug('Histórico carregado com sucesso', { count: history.length });
            return history;
        } catch (error: any) {
            this.logger.error('Erro ao carregar histórico', { error });
            return [];
        }
    }

    /**
     * Salva informações sobre ramificações
     */
    public async saveBranches(branches: Record<string, Array<number>>): Promise<void> {
        try {
            await fs.promises.writeFile(this.branchesFilePath, JSON.stringify(branches, null, 2));
            this.logger.debug('Ramificações salvas com sucesso', { branches });
        } catch (error: any) {
            this.logger.error('Erro ao salvar ramificações', { error });
            throw new Error(`Falha ao salvar ramificações: ${error?.message || 'Erro desconhecido'}`);
        }
    }

    /**
     * Carrega informações sobre ramificações
     */
    public async loadBranches(): Promise<Record<string, Array<number>>> {
        try {
            if (!fs.existsSync(this.branchesFilePath)) {
                return { 'main': [] };
            }

            const data = await fs.promises.readFile(this.branchesFilePath, 'utf-8');
            const branches = JSON.parse(data);
            this.logger.debug('Ramificações carregadas com sucesso', { branches });
            return branches;
        } catch (error: any) {
            this.logger.error('Erro ao carregar ramificações', { error });
            return { 'main': [] };
        }
    }

    /**
     * Limpa todo o armazenamento
     */
    public async clear(): Promise<void> {
        try {
            if (fs.existsSync(this.filePath)) {
                await fs.promises.unlink(this.filePath);
            }

            if (fs.existsSync(this.branchesFilePath)) {
                await fs.promises.unlink(this.branchesFilePath);
            }

            this.logger.info('Armazenamento limpo com sucesso');
        } catch (error: any) {
            this.logger.error('Erro ao limpar armazenamento', { error });
            throw new Error(`Falha ao limpar armazenamento: ${error?.message || 'Erro desconhecido'}`);
        }
    }
}

/**
 * Implementação de armazenamento em memória (sem persistência)
 */
export class MemoryStorageProvider implements StorageProvider {
    private thoughtHistory: ThoughtEntry[] = [];
    private branches: Record<string, Array<number>> = { 'main': [] };
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    public async saveThought(entry: ThoughtEntry): Promise<void> {
        const index = this.thoughtHistory.findIndex(t =>
            t.thoughtNumber === entry.thoughtNumber && t.branchId === entry.branchId
        );

        if (index >= 0) {
            this.thoughtHistory[index] = entry;
        } else {
            this.thoughtHistory.push(entry);
        }

        this.logger.debug('Pensamento salvo em memória', { entry });
    }

    public async loadHistory(): Promise<ThoughtEntry[]> {
        return [...this.thoughtHistory];
    }

    public async saveBranches(branches: Record<string, Array<number>>): Promise<void> {
        this.branches = { ...branches };
        this.logger.debug('Ramificações salvas em memória', { branches });
    }

    public async loadBranches(): Promise<Record<string, Array<number>>> {
        return { ...this.branches };
    }

    public async clear(): Promise<void> {
        this.thoughtHistory = [];
        this.branches = { 'main': [] };
        this.logger.debug('Armazenamento em memória limpo');
    }
}

/**
 * Fábrica para criar o provedor de armazenamento apropriado
 */
export class StorageFactory {
    public static createProvider(config: CoConuTConfig): StorageProvider {
        if (config.persistenceEnabled) {
            return new FileStorageProvider(config);
        } else {
            return new MemoryStorageProvider();
        }
    }
} 