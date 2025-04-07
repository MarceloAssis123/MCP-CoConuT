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
                userInfoNeeded: ['Definição inicial do problema'],
                suggestions: ['Comece definindo claramente o problema a ser resolvido']
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
            suggestions.push('Considere revisar os pensamentos anteriores, os scores não estão melhorando');
        }

        if (isTooLong) {
            suggestions.push('A cadeia está ficando muito longa sem atingir uma conclusão satisfatória');
        }

        if (isDeviation) {
            suggestions.push('Parece haver um desvio do objetivo inicial, reconsidere o propósito original');
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

        // Verificar por padrões que indiquem falta de informação
        if (lastThought.includes('informação insuficiente') ||
            lastThought.includes('preciso de mais dados') ||
            lastThought.includes('não está claro') ||
            lastThought.includes('falta de contexto')) {

            // Identificar tipos de informação que podem estar faltando
            if (lastThought.includes('requisitos')) {
                neededInfo.push('Requisitos mais detalhados');
                suggestions.push('Solicite ao usuário requisitos mais específicos para o problema');
            }

            if (lastThought.includes('contexto')) {
                neededInfo.push('Contexto de uso');
                suggestions.push('Peça ao usuário para explicar o contexto em que a solução será utilizada');
            }

            if (lastThought.includes('dados')) {
                neededInfo.push('Dados de exemplo');
                suggestions.push('Solicite dados de exemplo ou casos de uso concretos');
            }

            if (lastThought.includes('prioridades')) {
                neededInfo.push('Priorização de objetivos');
                suggestions.push('Peça ao usuário para priorizar os objetivos da solução');
            }

            if (lastThought.includes('preferências')) {
                neededInfo.push('Preferências de implementação');
                suggestions.push('Solicite preferências sobre tecnologias ou abordagens');
            }

            // Se nenhuma informação específica foi identificada, mas há indicação de falta de informação
            if (neededInfo.length === 0) {
                neededInfo.push('Detalhes adicionais sobre o problema');
                suggestions.push('Solicite mais detalhes sobre o problema ao usuário');
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
            case 'baixa':
                suggestedTotal = Math.min(5, currentTotal);
                if (currentTotal > 5) {
                    suggestions.push('O problema parece menos complexo do que o estimado inicialmente, considere reduzir o número total de pensamentos');
                }
                break;
            case 'média':
                suggestedTotal = Math.max(5, Math.min(8, currentTotal));
                if (currentTotal < 5) {
                    suggestions.push('O problema pode exigir mais pensamentos do que o previsto inicialmente');
                } else if (currentTotal > 8) {
                    suggestions.push('O número atual de pensamentos parece excessivo para este problema');
                }
                break;
            case 'alta':
                suggestedTotal = Math.max(8, currentTotal);
                if (currentTotal < 8) {
                    suggestions.push('Este problema é complexo e provavelmente exigirá mais pensamentos do que o estimado inicialmente');
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
    private estimateProblemComplexity(thoughts: ThoughtEntry[]): 'baixa' | 'média' | 'alta' {
        // Indicadores de complexidade
        let complexityIndicators = 0;

        // Analisar o conteúdo dos pensamentos
        for (const thought of thoughts) {
            const text = thought.thought.toLowerCase();

            // Termos que indicam complexidade
            if (text.includes('complexo') ||
                text.includes('difícil') ||
                text.includes('múltiplas etapas') ||
                text.includes('vários fatores') ||
                text.includes('interdependências')) {
                complexityIndicators++;
            }

            // Termos que indicam baixa complexidade
            if (text.includes('simples') ||
                text.includes('direto') ||
                text.includes('trivial') ||
                text.includes('óbvio')) {
                complexityIndicators--;
            }
        }

        // Número de pensamentos é também um indicador
        if (thoughts.length > 5) {
            complexityIndicators++;
        }
        if (thoughts.length > 8) {
            complexityIndicators++;
        }

        // Determinar complexidade com base nos indicadores
        if (complexityIndicators <= -1) {
            return 'baixa';
        } else if (complexityIndicators >= 2) {
            return 'alta';
        } else {
            return 'média';
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