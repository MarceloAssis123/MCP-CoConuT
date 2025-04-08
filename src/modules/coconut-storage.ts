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
 * Interface para metadados de conclusão
 */
interface ConclusionMetadata {
    id: string;
    timestamp: string;
    category: string;
    subCategories: string[];
    tags: string[];
    impactLevel: 'low' | 'medium' | 'high';
    affectedFiles: string[];
    relatedConclusions: string[];
    ticketReference?: string;
    businessContext?: string;
    technicalContext?: string;
    thoughtNumbers?: number[];
}

/**
 * Interface para o sistema de templates
 */
interface ConclusionTemplate {
    name: string;
    template: string;
}

/**
 * Interface para mensagens internacionalizadas
 */
interface I18nMessages {
    [key: string]: {
        [locale: string]: string;
    };
}

/**
 * Classe responsável por gerar conclusões e salvar o histórico final de pensamentos
 */
export class CoConuT_Storage {
    private logger: Logger;
    private storageProvider: StorageProvider;
    private config: CoConuTConfig;
    private locale: string = 'en'; // Default locale
    private templates: Map<string, ConclusionTemplate> = new Map();
    private searchIndex: Map<string, Set<string>> = new Map();

    /**
     * Mensagens internacionalizadas do sistema
     */
    private i18n: I18nMessages = {
        'error.no.path': {
            'en': 'No path provided to save files',
            'pt': 'Nenhum caminho foi fornecido para salvar os arquivos'
        },
        'info.adding.content': {
            'en': 'Adding new entry to existing conclusion file',
            'pt': 'Adicionando nova entrada ao arquivo de conclusão existente'
        },
        'info.creating.file': {
            'en': 'Creating new conclusion file',
            'pt': 'Criando novo arquivo de conclusão'
        },
        'error.saving.conclusion': {
            'en': 'Error saving conclusion',
            'pt': 'Erro ao salvar conclusão'
        },
        'error.adding.conclusion': {
            'en': 'Error adding text to conclusion file',
            'pt': 'Erro ao adicionar texto ao arquivo de conclusão'
        },
        'error.processing.conclusion': {
            'en': 'Failed to process conclusion',
            'pt': 'Falha ao processar conclusão'
        }
    };

    constructor(storageProvider: StorageProvider, config: CoConuTConfig) {
        this.storageProvider = storageProvider;
        this.config = config;
        this.logger = Logger.getInstance();

        // Verificar se o caminho do projeto está presente
        if (!config.projectPath) {
            this.logger.warn('CoConuT_Storage: No project path configured. It will need to be provided in processConclusion');
        }

        // Registrar o template padrão
        this.registerDefaultTemplates();
    }

    /**
     * Método para traduzir mensagens
     * @param key Chave da mensagem no dicionário
     * @param replacements Substituições a serem feitas na mensagem
     * @returns A mensagem traduzida
     */
    private t(key: string, replacements: Record<string, string> = {}): string {
        const message = this.i18n[key]?.[this.locale] || key;
        return message.replace(/\{(\w+)\}/g, (_, k) => replacements[k] || `{${k}}`);
    }

    /**
     * Define o idioma a ser usado pelo sistema
     * @param locale Código do idioma (en, pt, etc)
     */
    public setLocale(locale: string): void {
        if (Object.keys(this.i18n).some(key => this.i18n[key][locale])) {
            this.locale = locale;
            this.logger.info(`Locale set to ${locale}`);
        } else {
            this.logger.warn(`Locale ${locale} not supported, using ${this.locale}`);
        }
    }

    /**
     * Registra templates padrão
     */
    private registerDefaultTemplates(): void {
        this.registerTemplate('default', `## Conclusão da Cadeia de Pensamentos

### 🔍 Por que a mudança foi necessária
{whyChange}

### ✅ O que foi mudado
{whatChange}
`);

        this.registerTemplate('detailed', `## Conclusão da Cadeia de Pensamentos

---
id: "{id}"
timestamp: "{timestamp}"
category: "{category}"
impactLevel: "{impactLevel}"
---

### 📋 Contexto
{context}

### 🔍 Por que a mudança foi necessária
{whyChange}

### ✅ O que foi mudado
{whatChange}

### 📊 Impacto
**Nível de impacto:** {impactLevel}

### 📁 Arquivos afetados
{affectedFiles}

### 🔄 Alternativas consideradas
{alternatives}

### 🧪 Testes realizados
{testing}

### 🔗 Conclusões relacionadas
{relatedConclusions}
`);
    }

    /**
     * Registra um novo template
     * @param name Nome do template
     * @param template Template em formato de string com placeholders
     */
    public registerTemplate(name: string, template: string): void {
        this.templates.set(name, { name, template });
        this.logger.info(`Template ${name} registered`);
    }

    /**
     * Renderiza um template com os dados fornecidos
     * @param templateName Nome do template a ser renderizado
     * @param data Dados a serem inseridos no template
     * @returns Template renderizado
     */
    private renderTemplate(templateName: string, data: Record<string, any>): string {
        const template = this.templates.get(templateName);
        if (!template) {
            this.logger.warn(`Template ${templateName} not found, using default`);
            return this.renderTemplate('default', data);
        }

        // Renderização simples com substituição de placeholders
        return template.template.replace(/\{(\w+)\}/g, (_, key) => {
            if (data[key] === undefined) return `{${key}}`;
            if (Array.isArray(data[key])) {
                if (data[key].length === 0) return '';
                return data[key].map((item: any) => `- ${item}`).join('\n');
            }
            return data[key].toString();
        });
    }

    /**
     * Adiciona conteúdo ao índice de busca
     * @param id ID único da conclusão
     * @param content Conteúdo a ser indexado
     */
    private indexContent(id: string, content: string): void {
        try {
            // Extrair palavras do conteúdo
            const words = content.toLowerCase()
                .replace(/[^\p{L}\s]/gu, ' ') // Remove caracteres não-alfabéticos
                .split(/\s+/)
                .filter(word => word.length > 3); // Ignorar palavras muito curtas

            // Adicionar ao índice
            words.forEach(word => {
                if (!this.searchIndex.has(word)) {
                    this.searchIndex.set(word, new Set());
                }
                this.searchIndex.get(word)?.add(id);
            });

            this.logger.debug(`Indexed ${words.length} unique words for conclusion ${id}`);
        } catch (error) {
            this.logger.error('Error indexing content', { error });
        }
    }

    /**
     * Busca conclusões no índice
     * @param query Query de busca
     * @returns Array de IDs de conclusões ordenados por relevância
     */
    public searchConclusions(query: string): string[] {
        try {
            const searchTerms = query.toLowerCase()
                .replace(/[^\p{L}\s]/gu, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3);

            const results: Map<string, number> = new Map();

            // Buscar cada termo
            searchTerms.forEach(term => {
                const ids = this.searchIndex.get(term);
                if (ids) {
                    ids.forEach(id => {
                        results.set(id, (results.get(id) || 0) + 1);
                    });
                }
            });

            // Ordenar por relevância e retornar IDs
            return Array.from(results.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([id]) => id);
        } catch (error) {
            this.logger.error('Error searching conclusions', { error });
            return [];
        }
    }

    /**
     * Gera uma conclusão e salva o histórico de pensamentos
     * @param thoughts Histórico de pensamentos para processar
     * @param projectPath Caminho do projeto onde os arquivos serão salvos
     * @param whyChange Motivo da mudança
     * @param whatChange Descrição da mudança
     * @param params Parâmetros adicionais opcionais
     * @returns Array com informações dos arquivos salvos
     */
    public async processConclusion(thoughts: ThoughtEntry[], projectPath: string, whyChange: string, whatChange: string, params?: Partial<CoConuTStorageParams>): Promise<SavedFileInfo[]> {
        try {
            // Verificar e configurar o caminho do projeto
            if (!projectPath) {
                throw new Error(this.t('error.no.path'));
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
                try {
                    const fileInfo = await this.storageProvider.saveThought(thought);
                    if (fileInfo) {
                        savedFiles.push(fileInfo);
                    }
                } catch (thoughtError) {
                    this.logger.error('Error saving individual thought', { thoughtError, thoughtNumber: thought.thoughtNumber });
                    // Continuar tentando salvar os outros pensamentos
                }
            }

            // Registrar a conclusão em um arquivo separado
            const conclusionFileInfo = await this.saveConclusion(conclusion, projectPath);
            if (conclusionFileInfo) {
                savedFiles.push(conclusionFileInfo);
            }

            return savedFiles;
        } catch (error: any) {
            this.logger.error(this.t('error.processing.conclusion'), { error });
            throw new Error(`${this.t('error.processing.conclusion')}: ${error?.message || 'Unknown error'}`);
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
     * Gera metadados para a conclusão a partir dos parâmetros fornecidos
     * @param thoughts Array de pensamentos (opcional)
     * @param params Parâmetros adicionais
     * @returns Objeto de metadados estruturado
     */
    private generateMetadata(thoughts?: ThoughtEntry[], params?: Partial<CoConuTStorageParams>): ConclusionMetadata {
        try {
            const now = new Date();
            const metadata: ConclusionMetadata = {
                id: `conclusion-${now.getTime()}`,
                timestamp: now.toISOString(),
                category: params?.category || 'unspecified',
                subCategories: params?.subCategories || [],
                tags: params?.tags || [],
                impactLevel: params?.impactLevel || 'medium',
                affectedFiles: params?.affectedFiles || [],
                relatedConclusions: params?.relatedConclusions || [],
                ticketReference: params?.ticketReference || '',
                businessContext: params?.businessContext || '',
                technicalContext: params?.technicalContext || ''
            };

            // Adicionar números dos pensamentos se disponíveis
            if (thoughts && thoughts.length > 0) {
                metadata.thoughtNumbers = thoughts.map(t => t.thoughtNumber);
            }

            return metadata;
        } catch (error) {
            this.logger.error('Error generating metadata', { error });
            // Retornar metadados mínimos em caso de erro
            return {
                id: `conclusion-${Date.now()}`,
                timestamp: new Date().toISOString(),
                category: 'unspecified',
                subCategories: [],
                tags: [],
                impactLevel: 'medium',
                affectedFiles: [],
                relatedConclusions: []
            };
        }
    }

    /**
     * Generates a custom conclusion based on the provided parameters
     * @param whyChange Reason for the change
     * @param whatChange Description of the change
     * @param params Additional parameters
     * @returns Formatted conclusion string
     */
    private generateCustomConclusion(whyChange: string, whatChange: string, params?: Partial<CoConuTStorageParams>): string {
        try {
            // Gerar metadados
            const metadata = this.generateMetadata(undefined, params);

            // Serializar metadados para armazenamento
            const metadataJson = JSON.stringify(metadata, null, 2);

            // Preparar dados para o template
            const templateData: Record<string, any> = {
                ...metadata,
                whyChange,
                whatChange,
                context: this.formatContext(metadata),
                affectedFiles: this.formatAffectedFiles(metadata.affectedFiles),
                alternatives: this.formatAlternatives(params?.alternativesConsidered || []),
                testing: params?.testingPerformed || '',
                relatedConclusions: this.formatRelatedConclusions(metadata.relatedConclusions)
            };

            // Renderizar com o template detalhado
            let markdown = this.renderTemplate('detailed', templateData);

            // Adicionar snippets de código se houver
            if (params?.codeSnippets && params.codeSnippets.length > 0) {
                markdown += this.formatCodeSnippets(params.codeSnippets);
            }

            // Armazenar metadados JSON em comentário HTML para facilitar extração programática
            markdown += `\n<!-- metadata\n${metadataJson}\n-->\n`;

            return markdown;
        } catch (error) {
            this.logger.error('Error generating custom conclusion', { error });
            // Fallback simples em caso de erro
            return `## Conclusão da Cadeia de Pensamentos\n\n### Por que a mudança foi necessária\n${whyChange}\n\n### O que foi mudado\n${whatChange}\n\n`;
        }
    }

    /**
     * Formata a seção de contexto
     */
    private formatContext(metadata: ConclusionMetadata): string {
        try {
            let context = '';

            if (metadata.businessContext) {
                context += `#### Contexto de Negócio\n${metadata.businessContext}\n\n`;
            }

            if (metadata.technicalContext) {
                context += `#### Contexto Técnico\n${metadata.technicalContext}\n\n`;
            }

            return context || 'Nenhum contexto adicional fornecido.';
        } catch (error) {
            return 'Erro ao formatar contexto.';
        }
    }

    /**
     * Formata a lista de arquivos afetados
     */
    private formatAffectedFiles(files: string[]): string {
        try {
            if (!files || files.length === 0) {
                return 'Nenhum arquivo afetado especificado.';
            }

            return files.map(file => `- \`${file}\``).join('\n');
        } catch (error) {
            return 'Erro ao formatar arquivos afetados.';
        }
    }

    /**
     * Formata as alternativas consideradas
     */
    private formatAlternatives(alternatives: string[]): string {
        try {
            if (!alternatives || alternatives.length === 0) {
                return 'Nenhuma alternativa considerada foi especificada.';
            }

            return alternatives.map((alt, i) => `${i + 1}. ${alt}`).join('\n');
        } catch (error) {
            return 'Erro ao formatar alternativas consideradas.';
        }
    }

    /**
     * Formata as conclusões relacionadas
     */
    private formatRelatedConclusions(conclusions: string[]): string {
        try {
            if (!conclusions || conclusions.length === 0) {
                return 'Nenhuma conclusão relacionada.';
            }

            return conclusions.map(ref => `- ${ref}`).join('\n');
        } catch (error) {
            return 'Erro ao formatar conclusões relacionadas.';
        }
    }

    /**
     * Formata os snippets de código
     */
    private formatCodeSnippets(snippets: Array<{ before: string, after: string, file: string }>): string {
        try {
            if (!snippets || snippets.length === 0) return '';

            let result = `\n### 💻 Alterações de código\n`;

            snippets.forEach((snippet, index) => {
                result += `#### Alteração ${index + 1} em \`${snippet.file}\`\n`;
                result += `**Antes:**\n\`\`\`\n${snippet.before}\n\`\`\`\n\n`;
                result += `**Depois:**\n\`\`\`\n${snippet.after}\n\`\`\`\n\n`;
            });

            return result;
        } catch (error) {
            return '\n### 💻 Erro ao formatar snippets de código\n';
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
     * @param thoughts Array de pensamentos para analisar
     * @returns Array de tópicos principais
     */
    private extractMainTopics(thoughts: ThoughtEntry[]): string[] {
        try {
            // Lista de stop words em português e inglês
            const stopWords = new Set([
                // Português
                'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
                'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'pelo', 'pela', 'pelos', 'pelas',
                'com', 'que', 'se', 'como', 'mas', 'ou', 'e', 'foi', 'ser', 'está', 'são', 'estar',
                // Inglês
                'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about',
                'like', 'through', 'over', 'before', 'after', 'between', 'and', 'but', 'or', 'as',
                'if', 'than', 'because', 'while', 'where', 'how', 'when', 'what', 'who', 'is', 'are',
                'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
                'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might'
            ]);

            // Combinar todo o texto de pensamentos
            const allText = thoughts.map(t => t.thought).join(' ');

            // Dividir em palavras, filtrar stop words e palavras curtas
            const words = allText.toLowerCase()
                .replace(/[^\p{L}\s]/gu, ' ') // Remove caracteres não-alfabéticos
                .split(/\s+/)
                .filter(word => !stopWords.has(word) && word.length > 4);

            // Contar ocorrências de palavras
            const wordCount: Record<string, number> = {};
            words.forEach(word => {
                wordCount[word] = (wordCount[word] || 0) + 1;
            });

            // Extrair frases importantes (bigramas e trigramas)
            const phrases: Record<string, number> = {};
            for (let i = 0; i < thoughts.length; i++) {
                const sentences = thoughts[i].thought.split(/[.!?;]+/);
                for (const sentence of sentences) {
                    // Análise simples de importância: se contiver palavras-chave frequentes
                    const sentenceWords = sentence.toLowerCase().split(/\s+/);
                    const score = sentenceWords.reduce((sum, word) => sum + (wordCount[word] || 0), 0);
                    if (score > 5 && sentence.length > 20) {
                        const phrase = sentence.trim();
                        if (phrase.length > 0) {
                            phrases[phrase] = (phrases[phrase] || 0) + score;
                        }
                    }
                }
            }

            // Encontrar palavras-chave ponderadas por frequência e posição no texto
            const weightedWords: Record<string, number> = {};
            Object.entries(wordCount).forEach(([word, count]) => {
                // Considerar palavras no início/fim dos pensamentos como mais importantes
                let positionWeight = 0;
                thoughts.forEach(t => {
                    const firstWords = t.thought.split(/\s+/).slice(0, 20).join(' ').toLowerCase();
                    const lastWords = t.thought.split(/\s+/).slice(-20).join(' ').toLowerCase();

                    if (firstWords.includes(word)) positionWeight += 1.5;
                    if (lastWords.includes(word)) positionWeight += 1.2;
                });

                weightedWords[word] = count * (1 + positionWeight);
            });

            // Combinar palavras e frases chave
            const topWords = Object.entries(weightedWords)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([word]) => word);

            const topPhrases = Object.entries(phrases)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([phrase]) => phrase.length > 50 ? phrase.substring(0, 50) + '...' : phrase);

            return [...topWords, ...topPhrases];
        } catch (error) {
            this.logger.error('Error extracting main topics', { error });
            return ['error', 'extracting', 'topics'];
        }
    }

    /**
     * Identifica as principais mudanças na cadeia de pensamentos
     * @param thoughts Array de pensamentos
     * @returns Array de mudanças identificadas
     */
    private identifyKeyChanges(thoughts: ThoughtEntry[]): string[] {
        try {
            const changes: string[] = [];

            if (!thoughts || thoughts.length < 2) {
                return ["Poucos pensamentos para analisar mudanças significativas"];
            }

            // Analisar revisões explícitas
            for (let i = 1; i < thoughts.length; i++) {
                const curr = thoughts[i];

                // Verificar se há revisão explícita
                if (curr.metadata?.revisesThought) {
                    const revisedThoughtNum = curr.metadata.revisesThought;
                    const revisedThought = thoughts.find(t => t.thoughtNumber === revisedThoughtNum);

                    if (revisedThought) {
                        const summary = curr.thought.substring(0, 70).trim();
                        changes.push(`Revisão do pensamento ${revisedThoughtNum}: ${summary}...`);
                    }
                }

                // Verificar se há ramificações
                if (curr.metadata?.branchFromThought) {
                    changes.push(`Nova ramificação a partir do pensamento ${curr.metadata.branchFromThought}`);
                }

                // Verificar necessidade de mais pensamentos
                if (curr.metadata?.needsMoreThoughts) {
                    changes.push("Ajuste no plano: necessidade de mais pensamentos identificada");
                }

                // Verificar mudanças no score/confiança
                if (curr.metadata?.score !== undefined && i > 0 && thoughts[i - 1].metadata?.score !== undefined) {
                    const prevScore = thoughts[i - 1].metadata?.score as number;
                    const currScore = curr.metadata?.score as number;

                    if (Math.abs(currScore - prevScore) >= 2) {
                        const direction = currScore > prevScore ? "aumento" : "diminuição";
                        changes.push(`${direction} significativo na confiança (de ${prevScore} para ${currScore})`);
                    }
                }
            }

            // Analisar mudanças semânticas (abordagem simplificada)
            for (let i = 1; i < Math.min(thoughts.length, 5); i++) {
                const prev = thoughts[i - 1].thought.toLowerCase();
                const curr = thoughts[i].thought.toLowerCase();

                // Verificar negações - indicam possível mudança de direção
                const negationTerms = ['não', 'incorreto', 'errado', 'equivocado', 'falha', 'not', 'incorrect', 'wrong', 'mistaken'];
                const hasNegation = negationTerms.some(term =>
                    !prev.includes(term) && curr.includes(term) ||
                    prev.includes(term) && !curr.includes(term));

                if (hasNegation) {
                    changes.push(`Possível mudança de direção entre os pensamentos ${i} e ${i + 1}`);
                }

                // Termos que indicam descobertas
                const discoveryTerms = ['descobri', 'percebi', 'notei', 'found', 'discovered', 'realized', 'noticed'];
                if (discoveryTerms.some(term => curr.includes(term))) {
                    changes.push(`Nova descoberta ou percepção no pensamento ${i + 1}`);
                }
            }

            return changes.length > 0 ? changes : ["Não foram identificadas mudanças significativas na cadeia de pensamentos"];
        } catch (error) {
            this.logger.error('Error identifying key changes', { error });
            return ["Erro ao identificar mudanças"];
        }
    }

    /**
     * Gera um resumo da cadeia de pensamentos
     * @param thoughts Array de pensamentos
     * @returns Resumo formatado
     */
    private generateSummary(thoughts: ThoughtEntry[]): string {
        try {
            if (!thoughts || thoughts.length === 0) {
                return "Nenhum pensamento para analisar.";
            }

            // Informações básicas
            const totalThoughts = thoughts.length;
            const hasRevisions = thoughts.some(t => t.metadata?.revisesThought);
            const hasBranches = thoughts.some(t => t.metadata?.branchFromThought);

            // Calcular score médio se disponível
            let averageScore = null;
            const scores = thoughts
                .map(t => t.metadata?.score)
                .filter((score): score is number => typeof score === 'number');

            if (scores.length > 0) {
                averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            }

            // Identificar padrões
            const firstThought = thoughts[0].thought.substring(0, 100) + "...";
            const lastThought = thoughts[thoughts.length - 1].thought.substring(0, 100) + "...";

            // Gerar resumo com os detalhes identificados
            let summary = `Esta cadeia de pensamentos consistiu em ${totalThoughts} passos`;
            if (hasRevisions) summary += ", incluindo revisões de pensamentos anteriores";
            if (hasBranches) summary += " e explorações de ramificações alternativas";
            summary += ".\n\n";

            summary += `Começou com: "${firstThought}"\n\n`;
            summary += `Concluiu com: "${lastThought}"\n\n`;

            if (averageScore !== null) {
                summary += `A confiança média nos pensamentos foi de ${averageScore.toFixed(1)}/10.\n\n`;
            }

            // Adicionar informações sobre tópicos principais
            const topics = this.extractMainTopics(thoughts).slice(0, 5);
            if (topics.length > 0) {
                summary += `Os principais tópicos abordados foram: ${topics.join(', ')}.`;
            }

            return summary;
        } catch (error) {
            this.logger.error('Error generating summary', { error });
            return `Esta cadeia consistiu em ${thoughts.length} pensamentos, explorando vários aspectos do problema.`;
        }
    }

    /**
     * Explica as razões por trás das mudanças realizadas
     * @param thoughts Array de pensamentos
     * @returns Explicação formatada
     */
    private explainChanges(thoughts: ThoughtEntry[]): string {
        try {
            // Analisar motivos comuns de mudanças
            const motives = new Set<string>();

            // Analisar metadata em busca de motivos específicos
            for (let i = 1; i < thoughts.length; i++) {
                const curr = thoughts[i];

                // Verificar revisões
                if (curr.metadata?.revisesThought) {
                    motives.add("Revisão de pensamentos anteriores");
                }

                // Verificar mudanças no plano
                if (curr.metadata?.needsMoreThoughts) {
                    motives.add("Adaptação do plano devido a novos insights");
                }

                // Verificar ramificações
                if (curr.metadata?.branchFromThought) {
                    motives.add("Exploração de abordagens alternativas");
                }
            }

            // Analisar o conteúdo para motivos de mudança
            let allText = thoughts.map(t => t.thought).join(' ').toLowerCase();

            // Identificar termos relacionados a correção, adaptação, aprendizado
            const motiveIndicators = {
                "Correção de erros ou imprecisões": ["corrigi", "corrigir", "corrigido", "erro", "incorreto", "inexato", "fixed", "corrected", "wrong"],
                "Incorporação de novas informações": ["nova informação", "aprendi", "descobri", "nova perspectiva", "discovered", "learned"],
                "Aprofundamento da análise": ["aprofundar", "examinar", "detalhar", "analisar", "deeper", "analyze", "detailed"],
                "Validação de hipóteses": ["validar", "testar", "confirmar", "hypothesis", "test", "validate"],
                "Simplificação da abordagem": ["simplificar", "reduzir", "otimizar", "simplify", "optimize"],
                "Adaptação à complexidade do problema": ["complexo", "complexidade", "adaptar", "ajustar", "complex", "adapt"]
            };

            for (const [motive, terms] of Object.entries(motiveIndicators)) {
                if (terms.some(term => allText.includes(term))) {
                    motives.add(motive);
                }
            }

            // Se não encontrou motivos específicos, adicionar genéricos
            if (motives.size === 0) {
                motives.add("Melhorar a clareza do raciocínio");
                motives.add("Progressão lógica da análise");
                motives.add("Refinamento iterativo da solução");
            }

            // Formatar a explicação
            let explanation = `As mudanças foram motivadas principalmente pela necessidade de:`;
            Array.from(motives).forEach(motive => {
                explanation += `\n- ${motive}`;
            });

            return explanation;
        } catch (error) {
            this.logger.error('Error explaining changes', { error });
            return `As mudanças foram motivadas principalmente pela necessidade de refinar o raciocínio e explorar diferentes aspectos do problema.`;
        }
    }

    /**
     * Salva a conclusão em um arquivo separado
     * @param conclusion Texto da conclusão a ser salva
     * @param projectPath Caminho do projeto onde o arquivo será salvo
     */
    private async saveConclusion(conclusion: string, projectPath: string): Promise<SavedFileInfo | null> {
        try {
            // Verificar caminho
            if (!projectPath) {
                throw new Error(this.t('error.no.path'));
            }

            // Usar o método comum para preparar e salvar o conteúdo
            return await this.prepareAndSaveContent(conclusion, projectPath, true);
        } catch (error: any) {
            this.logger.error(this.t('error.saving.conclusion'), { error });
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
            // Verificar caminho
            if (!projectPath) {
                throw new Error(this.t('error.no.path'));
            }

            // Usar o método comum para preparar e salvar o conteúdo
            return await this.prepareAndSaveContent(text, projectPath, true);
        } catch (error: any) {
            this.logger.error(this.t('error.adding.conclusion'), { error });
            return null;
        }
    }

    /**
     * Prepara e salva conteúdo no arquivo de conclusão
     * @param text Texto a ser salvo
     * @param projectPath Caminho do projeto onde salvar
     * @param isNewEntry Se é uma entrada nova (adiciona timestamp)
     * @returns Informações sobre o arquivo salvo ou null em caso de erro
     */
    private async prepareAndSaveContent(
        text: string,
        projectPath: string,
        isNewEntry: boolean = true
    ): Promise<SavedFileInfo | null> {
        try {
            // Verificar caminho do projeto
            if (!projectPath) {
                throw new Error(this.t('error.no.path'));
            }

            // Criar caminhos
            const storageDir = path.resolve(projectPath, 'coconut-data');
            const conclusionPath = path.resolve(storageDir, 'conclusion.md');

            // Garantir que o diretório existe
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            // Preparar o conteúdo com timestamp se for uma nova entrada
            let processedText = text;
            if (isNewEntry) {
                const now = new Date();
                const dateStr = now.toLocaleDateString();
                const timeStr = now.toLocaleTimeString();
                const timestamp = `## Entrada em ${dateStr} às ${timeStr}`;
                processedText = `${timestamp}\n\n${text}`;
            }

            let finalContent = "";
            const separator = "\n\n---\n\n";

            // Verificar e adicionar conteúdo existente
            if (fs.existsSync(conclusionPath)) {
                const existingContent = await fs.promises.readFile(conclusionPath, 'utf-8');
                finalContent = existingContent + separator + processedText;
                this.logger.info(this.t('info.adding.content'));
            } else {
                finalContent = processedText;
                this.logger.info(this.t('info.creating.file'));
            }

            // Salvar o conteúdo
            await fs.promises.writeFile(conclusionPath, finalContent);

            // Se for uma conclusão completa, indexar o conteúdo para busca
            const conclusionId = `conclusion-${Date.now()}`;
            if (text.includes('## Conclusão da Cadeia de Pensamentos')) {
                this.indexContent(conclusionId, text);
            }

            return {
                filePath: conclusionPath,
                type: 'conclusion',
                timestamp: Date.now()
            };
        } catch (error: any) {
            const errorType = isNewEntry ? 'error.saving.conclusion' : 'error.adding.conclusion';
            this.logger.error(this.t(errorType), { error });
            return null;
        }
    }
} 