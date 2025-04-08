/**
 * Módulo do Analisador CoConuT (CoConuT_Analyser)
 * 
 * Implementa a análise da cadeia de pensamentos para:
 * 1. Verificar se o caminho atual atende ao pedido do usuário
 * 2. Verificar se é necessário mais informações do usuário
 * 3. Verificar se é necessário ajustar o número de pensamentos
 */

import { ICoConuTAnalyser } from './interfaces';
import { ThoughtEntry } from './types';

/**
 * Implementação do analisador CoConuT
 */
class CoConuTAnalyser implements ICoConuTAnalyser {
    /**
     * Analisa a cadeia de pensamentos atual
     */
    public analyseChainOfThought(thoughts: ThoughtEntry[]): {
        isOnRightTrack: boolean;
        needsMoreUserInfo: boolean;
        suggestedTotalThoughts: number;
        userInfoNeeded?: string[];
        suggestions?: string[];
    } {
        if (!thoughts || thoughts.length === 0) {
            return {
                isOnRightTrack: false,
                needsMoreUserInfo: true,
                suggestedTotalThoughts: 5,
                userInfoNeeded: ['Initial problem definition'],
                suggestions: ['Start by clearly defining the problem to be solved']
            };
        }

        // Obter o último pensamento
        const lastThought = thoughts[thoughts.length - 1];

        // Verificar se o caminho atende ao pedido
        const pathAnalysis = this.analysePath(thoughts);

        // Verificar necessidade de mais informações
        const infoAnalysis = this.analyseUserInfoNeeds(thoughts);

        // Verificar número ideal de pensamentos
        const totalThoughtsAnalysis = this.analyseTotalThoughts(thoughts);

        // Construir resposta
        return {
            isOnRightTrack: pathAnalysis.isOnRightTrack,
            needsMoreUserInfo: infoAnalysis.needsMoreInfo,
            suggestedTotalThoughts: totalThoughtsAnalysis.suggestedTotal,
            userInfoNeeded: infoAnalysis.neededInfo,
            suggestions: [
                ...pathAnalysis.suggestions,
                ...infoAnalysis.suggestions,
                ...totalThoughtsAnalysis.suggestions
            ]
        };
    }

    /**
     * Analisa se o caminho atual atende ao pedido do usuário
     */
    private analysePath(thoughts: ThoughtEntry[]): {
        isOnRightTrack: boolean;
        suggestions: string[];
    } {
        // Análise simplificada - em um sistema real, isso poderia usar
        // processamento de linguagem natural mais avançado

        // Verificar crescimento de score se disponível
        let isScoreImproving = true;
        let lastScore = 0;

        for (const thought of thoughts) {
            if (thought.score < lastScore) {
                isScoreImproving = false;
            }
            lastScore = thought.score;
        }

        // Verifica tamanho da cadeia (se estiver muito longa sem conclusão, pode estar fora do caminho)
        const isTooLong = thoughts.length > 10 && lastScore < 7;

        // Detectar possíveis desvios
        const isDeviation = this.detectPathDeviation(thoughts);

        const isOnRightTrack = isScoreImproving && !isTooLong && !isDeviation;

        const suggestions: string[] = [];

        if (!isScoreImproving) {
            suggestions.push('Consider reviewing previous thoughts, the scores are not improving');
        }

        if (isTooLong) {
            suggestions.push('The chain is getting too long without reaching a satisfactory conclusion');
        }

        if (isDeviation) {
            suggestions.push('There seems to be a deviation from the initial goal, reconsider the original purpose');
        }

        return {
            isOnRightTrack,
            suggestions
        };
    }

    /**
     * Analisa se há necessidade de mais informações do usuário
     */
    private analyseUserInfoNeeds(thoughts: ThoughtEntry[]): {
        needsMoreInfo: boolean;
        neededInfo: string[];
        suggestions: string[];
    } {
        // Lista para armazenar tipos de informação necessários
        const neededInfo: string[] = [];
        const suggestions: string[] = [];

        // Obtém o último pensamento
        const lastThought = thoughts[thoughts.length - 1].thought.toLowerCase();

        // Check for patterns indicating lack of information
        if (lastThought.includes('insufficient information') ||
            lastThought.includes('need more data') ||
            lastThought.includes('not clear') ||
            lastThought.includes('lack of context')) {

            // Identify types of information that may be missing
            if (lastThought.includes('requirements')) {
                neededInfo.push('More detailed requirements');
                suggestions.push('Ask the user for more specific requirements for the problem');
            }

            if (lastThought.includes('context')) {
                neededInfo.push('Usage context');
                suggestions.push('Ask the user to explain the context in which the solution will be used');
            }

            if (lastThought.includes('data')) {
                neededInfo.push('Example data');
                suggestions.push('Request example data or concrete use cases');
            }

            if (lastThought.includes('priorities')) {
                neededInfo.push('Goal prioritization');
                suggestions.push('Ask the user to prioritize the solution objectives');
            }

            if (lastThought.includes('preferences')) {
                neededInfo.push('Implementation preferences');
                suggestions.push('Request preferences about technologies or approaches');
            }

            // If no specific information was identified, but there is an indication of lack of information
            if (neededInfo.length === 0) {
                neededInfo.push('Additional details about the problem');
                suggestions.push('Request more details about the problem from the user');
            }
        }

        return {
            needsMoreInfo: neededInfo.length > 0,
            neededInfo,
            suggestions
        };
    }

    /**
     * Analisa se o número atual de pensamentos é adequado
     */
    private analyseTotalThoughts(thoughts: ThoughtEntry[]): {
        suggestedTotal: number;
        suggestions: string[];
    } {
        // Obtém o número atual e o total esperado do último pensamento
        const lastThought = thoughts[thoughts.length - 1];
        const currentNumber = lastThought.thoughtNumber;
        const currentTotal = Math.max(...thoughts.map(t => t.thoughtNumber));

        // Sugestões para o total de pensamentos
        const suggestions: string[] = [];
        let suggestedTotal = currentTotal;

        // Verificar a complexidade aparente do problema
        const complexity = this.estimateProblemComplexity(thoughts);

        // Baseado na complexidade, sugerir um número adequado
        switch (complexity) {
            case 'low':
                suggestedTotal = Math.min(5, currentTotal);
                if (currentTotal > 5) {
                    suggestions.push('The problem seems less complex than initially estimated, consider reducing the total number of thoughts');
                }
                break;
            case 'medium':
                suggestedTotal = Math.max(5, Math.min(8, currentTotal));
                if (currentTotal < 5) {
                    suggestions.push('The problem may require more thoughts than initially anticipated');
                } else if (currentTotal > 8) {
                    suggestions.push('The current number of thoughts seems excessive for this problem');
                }
                break;
            case 'high':
                suggestedTotal = Math.max(8, currentTotal);
                if (currentTotal < 8) {
                    suggestions.push('This problem is complex and will likely require more thoughts than initially estimated');
                }
                break;
        }

        return {
            suggestedTotal,
            suggestions
        };
    }

    /**
     * Estima a complexidade do problema com base nos pensamentos
     */
    private estimateProblemComplexity(thoughts: ThoughtEntry[]): 'low' | 'medium' | 'high' {
        // Complexity indicators
        let complexityIndicators = 0;

        // Analyze thought content
        for (const thought of thoughts) {
            const text = thought.thought.toLowerCase();

            // Terms indicating high complexity
            if (text.includes('complex') ||
                text.includes('difficult') ||
                text.includes('multiple steps') ||
                text.includes('various factors') ||
                text.includes('interdependencies')) {
                complexityIndicators++;
            }

            // Terms indicating low complexity
            if (text.includes('simple') ||
                text.includes('direct') ||
                text.includes('trivial') ||
                text.includes('obvious')) {
                complexityIndicators--;
            }
        }

        // Return complexity based on indicators
        if (complexityIndicators <= -2) {
            return 'low';
        } else if (complexityIndicators >= 2) {
            return 'high';
        } else {
            return 'medium';
        }
    }

    /**
     * Detecta possíveis desvios no caminho do raciocínio
     */
    private detectPathDeviation(thoughts: ThoughtEntry[]): boolean {
        if (thoughts.length < 3) {
            return false;
        }

        // Compara o primeiro e o último pensamento para ver se há um desvio significativo
        const firstThought = thoughts[0].thought.toLowerCase();
        const lastThought = thoughts[thoughts.length - 1].thought.toLowerCase();

        // Extrair palavras-chave do primeiro pensamento
        const firstKeywords = this.extractKeywords(firstThought);

        // Verificar quantas dessas palavras-chave ainda aparecem no último pensamento
        let matchingKeywords = 0;
        for (const keyword of firstKeywords) {
            if (lastThought.includes(keyword)) {
                matchingKeywords++;
            }
        }

        // Se menos de 30% das palavras-chave originais ainda estão presentes, pode ser um desvio
        return matchingKeywords < firstKeywords.length * 0.3;
    }

    /**
     * Extrai palavras-chave de um texto
     */
    private extractKeywords(text: string): string[] {
        // Lista de palavras comuns para filtrar (stopwords)
        const stopwords = [
            'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'até',
            'com', 'como', 'da', 'das', 'de', 'dessa', 'dessas', 'desse', 'desses', 'desta',
            'destas', 'deste', 'destes', 'deve', 'devem', 'devendo', 'dever', 'deverá',
            'deverão', 'deveria', 'deveriam', 'devia', 'deviam', 'disse', 'disso', 'disto',
            'dito', 'diz', 'dizem', 'do', 'dos', 'e', 'é', 'ela', 'elas', 'ele', 'eles', 'em',
            'enquanto', 'entre', 'era', 'eram', 'essa', 'essas', 'esse', 'esses', 'esta',
            'está', 'estamos', 'estão', 'estas', 'estava', 'estavam', 'estávamos', 'este',
            'esteja', 'estejam', 'estejamos', 'estes', 'esteve', 'estive', 'estivemos',
            'estiver', 'estivera', 'estiveram', 'estiverem', 'estivermos', 'estou', 'eu',
            'foi', 'fomos', 'for', 'fora', 'foram', 'forem', 'formos', 'fosse', 'fossem',
            'fôssemos', 'fui', 'há', 'haja', 'hajam', 'hajamos', 'hão', 'havemos', 'hei',
            'houve', 'houvemos', 'houver', 'houvera', 'houveram', 'houverei', 'houverem',
            'houveremos', 'houveria', 'houveriam', 'houvermos', 'houverá', 'houverão',
            'houveríamos', 'isso', 'isto', 'já', 'lhe', 'lhes', 'mais', 'mas', 'me', 'mesmo',
            'meu', 'meus', 'minha', 'minhas', 'muito', 'na', 'nas', 'nem', 'no', 'nos', 'nós',
            'nossa', 'nossas', 'nosso', 'nossos', 'num', 'numa', 'o', 'os', 'ou', 'para',
            'pela', 'pelas', 'pelo', 'pelos', 'por', 'qual', 'quando', 'que', 'quem', 'são',
            'se', 'seja', 'sejam', 'sejamos', 'sem', 'será', 'serão', 'seria', 'seriam',
            'seriamos', 'seu', 'seus', 'só', 'somos', 'sou', 'sua', 'suas', 'tais', 'tal',
            'também', 'te', 'tem', 'tém', 'têm', 'temos', 'tenha', 'tenham', 'tenhamos',
            'tenho', 'terá', 'terão', 'terei', 'teremos', 'teria', 'teriam', 'teríamos',
            'teu', 'teus', 'teve', 'tinha', 'tinham', 'tínhamos', 'tive', 'tivemos', 'tiver',
            'tivera', 'tiveram', 'tiverem', 'tivermos', 'tu', 'tua', 'tuas', 'um', 'uma',
            'você', 'vocês', 'vos', 'vós'
        ];

        // Dividir o texto em palavras e filtrar stopwords
        const words = text.split(/\s+/)
            .filter(word => word.length > 3) // Ignorar palavras muito curtas
            .filter(word => !stopwords.includes(word))
            .map(word => word.replace(/[.,;:!?()]/g, '')); // Remover pontuação

        // Remover duplicatas
        return [...new Set(words)];
    }
}

/**
 * Fábrica para criar analisadores
 */
export class AnalyserFactory {
    /**
     * Cria uma instância do analisador
     */
    public static createAnalyser(options: any = {}): ICoConuTAnalyser {
        return new CoConuTAnalyser();
    }
} 