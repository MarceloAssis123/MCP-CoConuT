/**
 * Módulo de armazenamento e conclusão para o CoConuT
 * Gera conclusões e explicações das mudanças realizadas na cadeia de pensamentos
 */

import * as fs from 'fs';
import * as path from 'path';
import { ThoughtEntry, CoConuTConfig, SavedFileInfo } from './types';
import { Logger } from './logger';
import { StorageProvider } from './storage';

/**
 * Classe responsável por gerar conclusões e salvar o histórico final de pensamentos
 */
export class CoConuT_Storage {
    private logger: Logger;
    private storageProvider: StorageProvider;
    private config: CoConuTConfig;

    constructor(storageProvider: StorageProvider, config: CoConuTConfig) {
        this.storageProvider = storageProvider;
        this.config = config;
        this.logger = Logger.getInstance();

        // Verificar se o caminho do projeto está presente
        if (!config.projectPath) {
            this.logger.warn('CoConuT_Storage: Nenhum caminho de projeto configurado. Será necessário fornecer no processConclusion');
        }
    }

    /**
     * Gera uma conclusão e salva o histórico de pensamentos
     * @param thoughts Histórico de pensamentos para processar
     * @param projectPath Caminho do projeto onde os arquivos serão salvos
     */
    public async processConclusion(thoughts: ThoughtEntry[], projectPath: string): Promise<SavedFileInfo[]> {
        try {
            // Verificar e configurar o caminho do projeto
            if (!projectPath) {
                throw new Error("CoConuT_Storage: É necessário fornecer um caminho para salvar os arquivos");
            }

            // Atualizar o caminho do projeto na configuração
            this.config.projectPath = projectPath;

            // Gerar conclusão baseada no histórico de pensamentos
            const conclusion = this.generateConclusion(thoughts);

            // Adicionar a conclusão como um metadado ao último pensamento
            const lastThought = thoughts[thoughts.length - 1];
            if (lastThought) {
                lastThought.metadata = lastThought.metadata || {};
                lastThought.metadata.conclusion = conclusion;
            }

            // Salvar todos os pensamentos
            const savedFiles: SavedFileInfo[] = [];
            for (const thought of thoughts) {
                const fileInfo = await this.storageProvider.saveThought(thought);
                if (fileInfo) {
                    savedFiles.push(fileInfo);
                }
            }

            // Registrar a conclusão em um arquivo separado
            const conclusionFileInfo = await this.saveConclusion(conclusion, projectPath);
            if (conclusionFileInfo) {
                savedFiles.push(conclusionFileInfo);
            }

            return savedFiles;
        } catch (error: any) {
            this.logger.error('Erro ao processar conclusão', { error });
            throw new Error(`Falha ao processar conclusão: ${error?.message || 'Erro desconhecido'}`);
        }
    }

    /**
     * Gera uma conclusão baseada no histórico de pensamentos
     */
    private generateConclusion(thoughts: ThoughtEntry[]): string {
        // Extrair tópicos principais dos pensamentos
        const topics = this.extractMainTopics(thoughts);

        // Identificar mudanças e decisões principais
        const changes = this.identifyKeyChanges(thoughts);

        // Formatar conclusão
        return `## Conclusão da Cadeia de Pensamentos

### Resumo
${this.generateSummary(thoughts)}

### Principais Decisões
${changes.map(change => `- ${change}`).join('\n')}

### Motivos das Mudanças
${this.explainChanges(thoughts)}
`;
    }

    /**
     * Extrai os principais tópicos abordados nos pensamentos
     */
    private extractMainTopics(thoughts: ThoughtEntry[]): string[] {
        // Implementação simples para extração de tópicos
        // Poderia ser melhorada com análise semântica ou NLP
        const allText = thoughts.map(t => t.thought).join(' ');
        const words = allText.toLowerCase().split(/\s+/);
        const wordCount: Record<string, number> = {};

        // Contar ocorrências de palavras
        for (const word of words) {
            if (word.length > 4) { // Ignorar palavras muito curtas
                wordCount[word] = (wordCount[word] || 0) + 1;
            }
        }

        // Ordenar por contagem e pegar os top 5
        return Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }

    /**
     * Identifica as principais mudanças na cadeia de pensamentos
     */
    private identifyKeyChanges(thoughts: ThoughtEntry[]): string[] {
        // Implementação simplificada
        // Uma versão mais avançada poderia usar comparação entre os pensamentos
        const changes: string[] = [];

        for (let i = 1; i < thoughts.length; i++) {
            const prev = thoughts[i - 1];
            const curr = thoughts[i];

            // Verificar se há revisão
            if (curr.metadata?.revisesThought) {
                changes.push(`Revisão do pensamento ${curr.metadata.revisesThought}: ${curr.thought.substring(0, 50)}...`);
            }

            // Verificar mudanças de direção no raciocínio
            // Implementação simplificada
        }

        return changes.length > 0 ? changes : ["Não foram identificadas mudanças significativas na cadeia de pensamentos"];
    }

    /**
     * Gera um resumo da cadeia de pensamentos
     */
    private generateSummary(thoughts: ThoughtEntry[]): string {
        // Implementação simplificada
        return `Esta cadeia de pensamentos consistiu em ${thoughts.length} passos. O raciocínio explorou diversos aspectos do problema e chegou a uma solução satisfatória.`;
    }

    /**
     * Explica as razões por trás das mudanças realizadas
     */
    private explainChanges(thoughts: ThoughtEntry[]): string {
        // Implementação simplificada
        return `As mudanças foram motivadas principalmente pela necessidade de:
- Melhorar a clareza do raciocínio
- Corrigir inconsistências nas etapas anteriores
- Explorar alternativas mais promissoras
- Incorporar novas informações descobertas durante o processo`;
    }

    /**
     * Salva a conclusão em um arquivo separado
     * @param conclusion Texto da conclusão a ser salva
     * @param projectPath Caminho do projeto onde o arquivo será salvo
     */
    private async saveConclusion(conclusion: string, projectPath: string): Promise<SavedFileInfo | null> {
        try {
            // Obter caminho base do armazenamento
            if (!projectPath) {
                throw new Error("Nenhum caminho foi fornecido para salvar os arquivos");
            }

            // Criar caminho para o arquivo de conclusão
            const storageDir = path.resolve(projectPath, 'coconut-data');
            const conclusionPath = path.resolve(storageDir, 'conclusion.md');

            // Garantir que o diretório existe
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            // Salvar a conclusão em formato markdown
            await fs.promises.writeFile(conclusionPath, conclusion);

            return {
                filePath: conclusionPath,
                type: 'conclusion',
                timestamp: Date.now()
            };
        } catch (error: any) {
            this.logger.error('Erro ao salvar conclusão', { error });
            return null;
        }
    }
} 