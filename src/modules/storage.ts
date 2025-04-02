/**
 * Sistema de persistência para histórico de pensamentos
 */

import * as fs from 'fs';
import * as path from 'path';
import { ThoughtEntry, CoConuTConfig } from './types';
import { Logger } from './logger';

/**
 * Obter o diretório raiz do projeto
 * @returns Caminho absoluto para o diretório raiz do projeto
 */
function getProjectRoot(): string {
    // Começa no diretório atual e sobe até encontrar o package.json
    let currentDir = process.cwd();

    // Percorre até 5 níveis de diretórios acima procurando o package.json
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break; // Chegou à raiz do sistema
        }

        currentDir = parentDir;
    }

    // Retorna o diretório atual se não encontrar o package.json
    return process.cwd();
}

/**
 * Interface para diferentes tipos de armazenamento
 */
export interface StorageProvider {
    initialize(): Promise<void>;
    saveThought(entry: ThoughtEntry): Promise<void>;
    loadHistory(): Promise<ThoughtEntry[]>;
    saveBranch(branchId: string, thoughtNumbers: number[]): Promise<void>;
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
        const projectRoot = getProjectRoot();

        // Resolve o caminho relativo ao diretório raiz do projeto
        // Se o caminho já for absoluto, path.resolve não altera
        const resolvedBasePath = basePath.startsWith('./') || basePath.startsWith('../')
            ? path.resolve(projectRoot, basePath)
            : path.resolve(basePath);

        this.filePath = path.join(resolvedBasePath, 'thought-history.json');
        this.branchesFilePath = path.join(resolvedBasePath, 'branches.json');
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

        this.logger.debug('Diretório de armazenamento configurado', {
            resolvedPath: resolvedBasePath,
            filePath: this.filePath,
            projectRoot
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
     * Salva informações sobre uma ramificação específica
     */
    public async saveBranch(branchId: string, thoughtNumbers: number[]): Promise<void> {
        try {
            // Carregar branches existentes
            const branches = await this.loadBranches();

            // Atualizar ou adicionar a branch específica
            branches[branchId] = thoughtNumbers;

            // Salvar branches atualizadas
            await fs.promises.writeFile(this.branchesFilePath, JSON.stringify(branches, null, 2));
            this.logger.debug('Ramificação salva com sucesso', { branchId, thoughtNumbers });
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

    /**
     * Salva uma ramificação específica
     */
    public async saveBranch(branchId: string, thoughtNumbers: number[]): Promise<void> {
        this.branches[branchId] = [...thoughtNumbers];
        this.logger.debug('Ramificação salva em memória', { branchId, thoughtNumbers });
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