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
        return {
            type: 'text',
            text: JSON.stringify(response, null, this.indentation)
        };
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
            branches,
            currentBranch,
            thoughtHistoryLength,
            hasCycle,
            reflexionPoints,
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
        markdown += `**Próximo pensamento necessário:** ${nextThoughtNeeded ? 'Sim' : 'Não'}\n`;
        markdown += `**Ramificação atual:** ${currentBranch} (${thoughtHistoryLength} pensamentos)\n`;
        markdown += `**Ciclo detectado:** ${hasCycle ? 'Sim' : 'Não'}\n\n`;

        // Ramificações disponíveis
        markdown += `### Ramificações disponíveis\n\n`;
        if (branches && branches.length > 0) {
            markdown += branches.map(branch =>
                `- ${branch}${branch === currentBranch ? ' (atual)' : ''}`
            ).join('\n');
        } else {
            markdown += '- Nenhuma ramificação disponível';
        }
        markdown += '\n\n';

        // Pontos de reflexão
        if (reflexionPoints) {
            markdown += `### Pontos de reflexão\n\n`;
            markdown += `- **Status do problema:** ${reflexionPoints.isProblemBeingSolved}\n`;
            markdown += `- **Aumentar total de pensamentos:** ${reflexionPoints.shouldIncreaseTotalThoughts ? 'Sim' : 'Não'}\n`;
            markdown += `- **Necessita input do usuário:** ${reflexionPoints.needsUserInput ? 'Sim' : 'Não'}\n\n`;
        }

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
            branches,
            currentBranch,
            thoughtHistoryLength,
            hasCycle,
            reflexionPoints,
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
        html += `<p><strong>Ramificação atual:</strong> ${currentBranch} (${thoughtHistoryLength} pensamentos)</p>`;
        html += `<p><strong>Ciclo detectado:</strong> ${hasCycle ? 'Sim' : 'Não'}</p>`;
        html += `</div>`;

        // Ramificações disponíveis
        html += `<div class="branches">`;
        html += `<h3>Ramificações disponíveis</h3>`;
        html += `<ul>`;
        if (branches && branches.length > 0) {
            branches.forEach(branch => {
                html += `<li>${branch}${branch === currentBranch ? ' (atual)' : ''}</li>`;
            });
        } else {
            html += `<li>Nenhuma ramificação disponível</li>`;
        }
        html += `</ul>`;
        html += `</div>`;

        // Pontos de reflexão
        if (reflexionPoints) {
            html += `<div class="reflection-points">`;
            html += `<h3>Pontos de reflexão</h3>`;
            html += `<ul>`;
            html += `<li><strong>Status do problema:</strong> ${reflexionPoints.isProblemBeingSolved}</li>`;
            html += `<li><strong>Aumentar total de pensamentos:</strong> ${reflexionPoints.shouldIncreaseTotalThoughts ? 'Sim' : 'Não'}</li>`;
            html += `<li><strong>Necessita input do usuário:</strong> ${reflexionPoints.needsUserInput ? 'Sim' : 'Não'}</li>`;
            html += `</ul>`;
            html += `</div>`;
        }

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