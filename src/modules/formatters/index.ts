/**
 * Formatadores de resposta para diferentes formatos
 */

import { IResponseFormatter } from '../interfaces';
import { CoConuTResponse } from '../types';

/**
 * Formatador base para respostas
 */
export abstract class BaseFormatter implements IResponseFormatter {
    /**
     * Formata uma resposta para o formato específico
     */
    abstract format(response: CoConuTResponse): {
        type: string;
        text: string;
    };
}

/**
 * Formatador JSON padrão
 */
export class JsonFormatter extends BaseFormatter {
    private indentation: number;

    constructor(indentation: number = 2) {
        super();
        this.indentation = indentation;
    }

    format(response: CoConuTResponse): { type: string; text: string; } {
        try {
            // Garantir que a resposta é um objeto válido
            const safeResponse = { ...response };

            // Garantir que arrays vazios ou nulos sejam tratados corretamente
            if (safeResponse.options === null || safeResponse.options === undefined) {
                delete safeResponse.options;
            } else if (!Array.isArray(safeResponse.options)) {
                safeResponse.options = [];
            }

            // Verificar campos de análise
            if (safeResponse.analysis) {
                const safeAnalysis = { ...safeResponse.analysis };

                // Garantir que arrays na análise sejam válidos
                if (safeAnalysis.userInfoNeeded === null || safeAnalysis.userInfoNeeded === undefined) {
                    delete safeAnalysis.userInfoNeeded;
                } else if (!Array.isArray(safeAnalysis.userInfoNeeded)) {
                    safeAnalysis.userInfoNeeded = [];
                }

                if (safeAnalysis.suggestions === null || safeAnalysis.suggestions === undefined) {
                    delete safeAnalysis.suggestions;
                } else if (!Array.isArray(safeAnalysis.suggestions)) {
                    safeAnalysis.suggestions = [];
                }

                safeResponse.analysis = safeAnalysis;
            }

            // Serializar para JSON
            return {
                type: 'text',
                text: JSON.stringify(safeResponse, null, this.indentation)
            };
        } catch (error) {
            // Em caso de erro, retornar um JSON simplificado
            console.error('Erro ao formatar resposta JSON:', error);
            return {
                type: 'text',
                text: JSON.stringify({
                    thoughtNumber: response.thoughtNumber || 0,
                    totalThoughts: response.totalThoughts || 0,
                    nextThoughtNeeded: false,
                    error: `Erro ao formatar resposta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
                }, null, this.indentation)
            };
        }
    }
}

/**
 * Formatador Markdown
 */
export class MarkdownFormatter extends BaseFormatter {
    format(response: CoConuTResponse): { type: string; text: string; } {
        const {
            thoughtNumber,
            totalThoughts,
            nextThoughtNeeded,
            action,
            inputType,
            message,
            options,
            error
        } = response;

        // Construir markdown
        let markdown = `## Resposta CoConuT\n\n`;

        // Informações básicas
        markdown += `**Pensamento:** ${thoughtNumber} de ${totalThoughts}\n`;
        markdown += `**Próximo pensamento necessário:** ${nextThoughtNeeded ? 'Sim' : 'Não'}\n\n`;

        // Ação
        if (action) {
            markdown += `### Ação: ${action}\n\n`;

            if (action === 'REQUEST_INPUT' && message) {
                markdown += `**${message}**\n\n`;

                if (options && options.length > 0) {
                    markdown += `Opções disponíveis:\n\n`;
                    markdown += options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
                    markdown += '\n\n';
                }
            }
        }

        // Erro
        if (error) {
            markdown += `### Erro\n\n`;
            markdown += `\`\`\`\n${error}\n\`\`\`\n\n`;
        }

        return {
            type: 'markdown',
            text: markdown
        };
    }
}

/**
 * Formatador HTML
 */
export class HtmlFormatter extends BaseFormatter {
    format(response: CoConuTResponse): { type: string; text: string; } {
        const {
            thoughtNumber,
            totalThoughts,
            nextThoughtNeeded,
            action,
            inputType,
            message,
            options,
            error
        } = response;

        // Construir HTML
        let html = `<div class="coconut-response">`;

        // Informações básicas
        html += `<h2>Resposta CoConuT</h2>`;
        html += `<div class="response-info">`;
        html += `<p><strong>Pensamento:</strong> ${thoughtNumber} de ${totalThoughts}</p>`;
        html += `<p><strong>Próximo pensamento necessário:</strong> ${nextThoughtNeeded ? 'Sim' : 'Não'}</p>`;
        html += `</div>`;

        // Ação
        if (action) {
            html += `<div class="action">`;
            html += `<h3>Ação: ${action}</h3>`;

            if (action === 'REQUEST_INPUT' && message) {
                html += `<p class="message"><strong>${message}</strong></p>`;

                if (options && options.length > 0) {
                    html += `<div class="options">`;
                    html += `<p>Opções disponíveis:</p>`;
                    html += `<ol>`;
                    options.forEach(opt => {
                        html += `<li>${opt}</li>`;
                    });
                    html += `</ol>`;
                    html += `</div>`;
                }
            }
            html += `</div>`;
        }

        // Erro
        if (error) {
            html += `<div class="error">`;
            html += `<h3>Erro</h3>`;
            html += `<pre>${error}</pre>`;
            html += `</div>`;
        }

        html += `</div>`;

        return {
            type: 'html',
            text: html
        };
    }
}

/**
 * Fábrica de formatadores de resposta
 */
export class FormatterFactory {
    /**
     * Cria um formatador para o formato especificado
     */
    static createFormatter(format: string = 'json'): IResponseFormatter {
        switch (format.toLowerCase()) {
            case 'markdown':
            case 'md':
                return new MarkdownFormatter();
            case 'html':
                return new HtmlFormatter();
            case 'json':
            default:
                return new JsonFormatter();
        }
    }
} 