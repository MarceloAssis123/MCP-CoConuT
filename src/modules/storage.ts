/**
 * Sistema de persistência para histórico de pensamentos
 */

import * as fs from 'fs';
import * as path from 'path';
import { ThoughtEntry, CoConuTConfig, SavedFileInfo } from './types';
import { Logger } from './logger';

/**
 * Interface para diferentes tipos de armazenamento
 */
export interface StorageProvider {
    initialize(): Promise<void>;
    saveThought(entry: ThoughtEntry): Promise<SavedFileInfo | null>;
    loadHistory(): Promise<ThoughtEntry[]>;
    saveBranch(branchId: string, thoughtNumbers: number[]): Promise<SavedFileInfo | null>;
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
        // Verificar se o caminho foi fornecido, caso contrário, retornar erro
        if (!config.projectPath) {
            const errorMsg = "Nenhum caminho foi fornecido para salvar os arquivos";
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        // Garantir que o caminho é absoluto
        const basePath = config.projectPath;

        // Criar diretório de dados no caminho especificado
        const storageDir = path.resolve(basePath, 'coconut-data');

        // Log para debug
        console.log('Diretório de armazenamento:', storageDir);

        this.filePath = path.resolve(storageDir, 'thought-history.json');
        this.branchesFilePath = path.resolve(storageDir, 'branches.json');
        this.logger = Logger.getInstance();

        // Garantir que o diretório existe
        if (!fs.existsSync(storageDir)) {
            try {
                fs.mkdirSync(storageDir, { recursive: true });
                console.log('Diretório de armazenamento criado:', storageDir);
                this.logger.info('Diretório de armazenamento criado', { storageDir });
            } catch (error: any) {
                console.error('Falha ao criar diretório de armazenamento:', error);
                this.logger.error('Falha ao criar diretório de armazenamento', { error, storageDir });
            }
        }

        this.logger.debug('Diretório de armazenamento configurado', {
            basePath,
            storageDir,
            filePath: this.filePath,
            usingProvidedPath: Boolean(config.projectPath)
        });
    }

    /**
     * Inicializa o provedor de armazenamento
     */
    public async initialize(): Promise<void> {
        // Para FileStorageProvider, a inicialização acontece no construtor
        // Esta implementação é apenas para compatibilidade com a interface
        this.logger.debug('FileStorageProvider inicializado');
    }

    /**
     * Salva um pensamento no armazenamento
     * @returns Informações sobre o arquivo salvo
     */
    public async saveThought(entry: ThoughtEntry): Promise<SavedFileInfo | null> {
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

            // Retornar informações sobre o arquivo salvo
            return {
                filePath: this.filePath,
                type: 'thought',
                timestamp: Date.now()
            };
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
     * Salva informações sobre uma ramificação específica
     * @returns Informações sobre o arquivo salvo
     */
    public async saveBranch(branchId: string, thoughtNumbers: number[]): Promise<SavedFileInfo | null> {
        try {
            // Carregar branches existentes
            const branches = await this.loadBranches();

            // Atualizar ou adicionar a branch específica
            branches[branchId] = thoughtNumbers;

            // Salvar branches atualizadas
            await fs.promises.writeFile(this.branchesFilePath, JSON.stringify(branches, null, 2));
            this.logger.debug('Ramificação salva com sucesso', { branchId, thoughtNumbers });

            // Retornar informações sobre o arquivo salvo
            return {
                filePath: this.branchesFilePath,
                type: 'branch',
                timestamp: Date.now()
            };
        } catch (error: any) {
            this.logger.error('Erro ao salvar ramificação', { error, branchId });
            throw new Error(`Falha ao salvar ramificação: ${error?.message || 'Erro desconhecido'}`);
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

    /**
     * Inicializa o provedor de armazenamento em memória
     */
    public async initialize(): Promise<void> {
        // Para MemoryStorageProvider, não há inicialização especial necessária
        this.logger.debug('MemoryStorageProvider inicializado');
    }

    /**
     * Salva um pensamento na memória
     * @returns null, já que não há arquivo físico
     */
    public async saveThought(entry: ThoughtEntry): Promise<SavedFileInfo | null> {
        const index = this.thoughtHistory.findIndex(t =>
            t.thoughtNumber === entry.thoughtNumber && t.branchId === entry.branchId
        );

        if (index >= 0) {
            this.thoughtHistory[index] = entry;
        } else {
            this.thoughtHistory.push(entry);
        }

        this.logger.debug('Pensamento salvo em memória', { entry });

        // Retorna null, pois não há arquivo físico
        return null;
    }

    public async loadHistory(): Promise<ThoughtEntry[]> {
        return [...this.thoughtHistory];
    }

    /**
     * Salva uma ramificação específica na memória
     * @returns null, já que não há arquivo físico
     */
    public async saveBranch(branchId: string, thoughtNumbers: number[]): Promise<SavedFileInfo | null> {
        this.branches[branchId] = [...thoughtNumbers];
        this.logger.debug('Ramificação salva em memória', { branchId, thoughtNumbers });

        // Retorna null, pois não há arquivo físico
        return null;
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
 * Fábrica para criar provedores de armazenamento
 */
export class StorageFactory {
    public static createProvider(config: CoConuTConfig): StorageProvider {
        // Verificar se estamos usando persistência
        if (config.persistenceEnabled) {
            // Verificar se um caminho de projeto foi fornecido
            if (!config.projectPath) {
                const errorMsg = "Nenhum caminho foi fornecido para salvar os arquivos e persistência está habilitada";
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            // Criar provedor de arquivo
            return new FileStorageProvider(config);
        } else {
            // Se persistência não estiver habilitada, usar armazenamento em memória
            return new MemoryStorageProvider();
        }
    }
} 