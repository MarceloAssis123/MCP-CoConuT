/**
 * Storage and conclusion module for CoConuT
 * Generates conclusions and explanations of changes made in the chain of thoughts
 */

import * as fs from 'fs';
import * as path from 'path';
import { ThoughtEntry, CoConuTConfig, SavedFileInfo, CoConuTStorageParams } from './types';
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
            this.logger.warn('CoConuT_Storage: No project path configured. It will need to be provided in processConclusion');
        }
    }

    /**
     * Gera uma conclusão e salva o histórico de pensamentos
     * @param thoughts Histórico de pensamentos para processar
     * @param projectPath Caminho do projeto onde os arquivos serão salvos
     * @param whyChange Motivo da mudança
     * @param whatChange Descrição da mudança
     */
    public async processConclusion(thoughts: ThoughtEntry[], projectPath: string, whyChange: string, whatChange: string, params?: Partial<CoConuTStorageParams>): Promise<SavedFileInfo[]> {
        try {
            // Verificar e configurar o caminho do projeto
            if (!projectPath) {
                throw new Error("CoConuT_Storage: A path must be provided to save the files");
            }

            // Atualizar o caminho do projeto na configuração
            this.config.projectPath = projectPath;

            // Mesclar parâmetros recebidos
            const fullParams: Partial<CoConuTStorageParams> = {
                ...params,
                projectPath,
                WhyChange: whyChange,
                WhatChange: whatChange
            };

            // Gerar conclusão baseada nos parâmetros fornecidos
            const conclusion = this.generateCustomConclusion(whyChange, whatChange, fullParams);

            // Adicionar a conclusão como um metadado ao último pensamento
            const lastThought = thoughts[thoughts.length - 1];
            if (lastThought) {
                lastThought.metadata = lastThought.metadata || {};
                lastThought.metadata.conclusion = conclusion;
                lastThought.metadata.whyChange = whyChange;
                lastThought.metadata.whatChange = whatChange;

                // Adicionar metadados enriquecidos
                if (params) {
                    lastThought.metadata.category = params.category;
                    lastThought.metadata.tags = params.tags;
                    lastThought.metadata.impactLevel = params.impactLevel;
                }
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
            this.logger.error('Error processing conclusion', { error });
            throw new Error(`Failed to process conclusion: ${error?.message || 'Unknown error'}`);
        }
    }

    /**
     * Automatically records a summary of the current interaction in the conclusion.md file
     * @param projectPath Project path where the files will be saved
     * @param interactionSummary An object containing information about the current interaction
     * @returns Information about the saved file or null in case of error
     */
    public async appendInteractionSummary(
        projectPath: string,
        interactionSummary: {
            thoughtNumber: number,
            totalThoughts: number,
            what: string,
            why: string
        }
    ): Promise<SavedFileInfo | null> {
        try {
            // Verify and configure the project path
            if (!projectPath) {
                throw new Error("A path must be provided to save the interaction summary");
            }

            // Create interaction summary text
            const summary = `## Resumo da Interação ${interactionSummary.thoughtNumber}/${interactionSummary.totalThoughts}

### Por que foi feito
${interactionSummary.why}

### O que foi feito
${interactionSummary.what}`;

            // Save the summary to the conclusion.md file
            return await this.appendToConclusion(summary, projectPath);
        } catch (error: any) {
            this.logger.error('Error recording interaction summary', { error });
            return null;
        }
    }

    /**
     * Generates a custom conclusion based on the provided parameters
     * @param whyChange Reason for the change
     * @param whatChange Description of the change
     */
    private generateCustomConclusion(whyChange: string, whatChange: string, params?: Partial<CoConuTStorageParams>): string {
        // Gerar ID único para a conclusão
        const now = new Date();
        const conclusionId = `conclusion-${now.getTime()}`;

        // Extrair metadados dos parâmetros
        const metadata = {
            id: conclusionId,
            timestamp: now.toISOString(),
            category: params?.category || 'unspecified',
            subCategories: params?.subCategories || [],
            tags: params?.tags || [],
            impactLevel: params?.impactLevel || 'medium',
            affectedFiles: params?.affectedFiles || [],
            relatedConclusions: params?.relatedConclusions || [],
            ticketReference: params?.ticketReference || '',
            businessContext: params?.businessContext || '',
            alternativesConsidered: params?.alternativesConsidered || [],
            testingPerformed: params?.testingPerformed || '',
            technicalContext: params?.technicalContext || ''
        };

        // Serializar metadados para armazenamento
        const metadataJson = JSON.stringify(metadata, null, 2);

        // Construir conclusão enriquecida com YAML front matter para metadados
        let markdown = `## Conclusão da Cadeia de Pensamentos\n\n`;

        // Adicionar metadados em formato YAML front matter para ferramentas como Jekyll/Hugo
        markdown += `---\n`;
        markdown += `id: "${conclusionId}"\n`;
        markdown += `timestamp: "${metadata.timestamp}"\n`;
        markdown += `category: "${metadata.category}"\n`;

        if (metadata.subCategories.length > 0) {
            markdown += `subCategories: [${metadata.subCategories.map(c => `"${c}"`).join(', ')}]\n`;
        }

        if (metadata.tags.length > 0) {
            markdown += `tags: [${metadata.tags.map(t => `"${t}"`).join(', ')}]\n`;
        }

        markdown += `impactLevel: "${metadata.impactLevel}"\n`;

        if (metadata.ticketReference) {
            markdown += `ticketReference: "${metadata.ticketReference}"\n`;
        }
        markdown += `---\n\n`;

        // Seção de contexto
        markdown += `### 📋 Contexto\n`;
        if (metadata.businessContext) {
            markdown += `#### Contexto de Negócio\n${metadata.businessContext}\n\n`;
        }

        if (metadata.technicalContext) {
            markdown += `#### Contexto Técnico\n${metadata.technicalContext}\n\n`;
        }

        // Seções principais
        markdown += `### 🔍 Por que a mudança foi necessária\n${whyChange}\n\n`;

        markdown += `### ✅ O que foi mudado\n${whatChange}\n\n`;

        // Seção de impacto
        markdown += `### 📊 Impacto\n`;
        markdown += `**Nível de impacto:** ${metadata.impactLevel.toUpperCase()}\n\n`;

        // Arquivos afetados
        if (metadata.affectedFiles.length > 0) {
            markdown += `### 📁 Arquivos afetados\n`;
            metadata.affectedFiles.forEach(file => {
                markdown += `- \`${file}\`\n`;
            });
            markdown += `\n`;
        }

        // Snippets de código
        if (params?.codeSnippets && params.codeSnippets.length > 0) {
            markdown += `### 💻 Alterações de código\n`;
            params.codeSnippets.forEach((snippet, index) => {
                markdown += `#### Alteração ${index + 1} em \`${snippet.file}\`\n`;
                markdown += `**Antes:**\n\`\`\`\n${snippet.before}\n\`\`\`\n\n`;
                markdown += `**Depois:**\n\`\`\`\n${snippet.after}\n\`\`\`\n\n`;
            });
        }

        // Alternativas consideradas
        if (metadata.alternativesConsidered.length > 0) {
            markdown += `### 🔄 Alternativas consideradas\n`;
            metadata.alternativesConsidered.forEach((alt, index) => {
                markdown += `${index + 1}. ${alt}\n`;
            });
            markdown += `\n`;
        }

        // Testes realizados
        if (metadata.testingPerformed) {
            markdown += `### 🧪 Testes realizados\n${metadata.testingPerformed}\n\n`;
        }

        // Relações com outras conclusões
        if (metadata.relatedConclusions.length > 0) {
            markdown += `### 🔗 Conclusões relacionadas\n`;
            metadata.relatedConclusions.forEach(ref => {
                markdown += `- ${ref}\n`;
            });
            markdown += `\n`;
        }

        // Armazenar metadados JSON em comentário HTML para facilitar extração programática
        markdown += `<!-- metadata\n${metadataJson}\n-->\n`;

        return markdown;
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

            // Adicionar data e hora à conclusão
            const now = new Date();
            const dateStr = now.toLocaleDateString();
            const timeStr = now.toLocaleTimeString();

            // Preparar a nova entrada com separador e data/hora
            const separator = "\n\n---\n\n";
            const timestamp = `## Entrada em ${dateStr} às ${timeStr}`;
            const newEntry = `${timestamp}\n\n${conclusion}`;

            let finalContent = "";

            // Verificar se o arquivo já existe
            if (fs.existsSync(conclusionPath)) {
                // Ler o conteúdo existente
                const existingContent = await fs.promises.readFile(conclusionPath, 'utf-8');
                // Adicionar o novo conteúdo ao final do existente
                finalContent = existingContent + separator + newEntry;

                this.logger.info('Adicionando nova entrada ao arquivo de conclusão existente');
            } else {
                // Se o arquivo não existe, usar apenas o novo conteúdo
                finalContent = newEntry;
                this.logger.info('Criando novo arquivo de conclusão');
            }

            // Salvar o conteúdo combinado em formato markdown
            await fs.promises.writeFile(conclusionPath, finalContent);

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

    /**
     * Adiciona texto ao arquivo de conclusão sem substituir o conteúdo existente
     * @param text Texto a ser adicionado ao arquivo de conclusão
     * @param projectPath Caminho do projeto onde o arquivo será salvo
     */
    private async appendToConclusion(text: string, projectPath: string): Promise<SavedFileInfo | null> {
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

            // Adicionar data e hora ao texto
            const now = new Date();
            const dateStr = now.toLocaleDateString();
            const timeStr = now.toLocaleTimeString();

            // Preparar a nova entrada com separador e data/hora
            const separator = "\n\n---\n\n";
            const timestamp = `## Entrada em ${dateStr} às ${timeStr}`;
            const newEntry = `${timestamp}\n\n${text}`;

            let finalContent = "";

            // Verificar se o arquivo já existe
            if (fs.existsSync(conclusionPath)) {
                // Ler o conteúdo existente
                const existingContent = await fs.promises.readFile(conclusionPath, 'utf-8');
                // Adicionar o novo conteúdo ao final do existente
                finalContent = existingContent + separator + newEntry;

                this.logger.info('Adicionando nova entrada ao arquivo de conclusão existente');
            } else {
                // Se o arquivo não existe, usar apenas o novo conteúdo
                finalContent = newEntry;
                this.logger.info('Criando novo arquivo de conclusão');
            }

            // Salvar o conteúdo combinado em formato markdown
            await fs.promises.writeFile(conclusionPath, finalContent);

            return {
                filePath: conclusionPath,
                type: 'conclusion',
                timestamp: Date.now()
            };
        } catch (error: any) {
            this.logger.error('Erro ao adicionar texto ao arquivo de conclusão', { error });
            return null;
        }
    }
} 