/**
 * Sistema avançado para detecção de ciclos no pensamento
 */

import { Logger } from './logger';
import { ICycleDetector } from './interfaces';

/**
 * Interface para detectores de ciclos de pensamento
 */
export interface CycleDetector {
    detectCycles(thoughts: string[], newThought: string): boolean;
}

/**
 * Implementação de detector de ciclo baseado em similaridade de texto
 */
export class SimilarityBasedCycleDetector implements CycleDetector {
    private threshold: number;
    private minThoughts: number;
    private logger: Logger;

    constructor(threshold = 0.8, minThoughts = 4) {
        this.threshold = threshold;
        this.minThoughts = minThoughts;
        this.logger = Logger.getInstance();
    }

    /**
     * Detecta ciclos baseado em similaridade de texto
     */
    public detectCycles(thoughts: string[], newThought: string): boolean {
        if (thoughts.length < this.minThoughts) {
            return false;
        }

        // Verificar similaridade com pensamentos anteriores
        for (let i = 0; i < thoughts.length; i++) {
            const similarity = this.calculateSimilarity(newThought, thoughts[i]);
            if (similarity > this.threshold) {
                this.logger.info('Ciclo detectado baseado em similaridade', {
                    similarity,
                    index: i,
                    threshold: this.threshold
                });
                return true;
            }
        }

        return false;
    }

    /**
     * Calcula similaridade entre duas strings usando distância de Levenshtein normalizada
     */
    public calculateSimilarity(a: string, b: string): number {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1.0;

        // Calcular distância de Levenshtein
        let costs = Array(shorter.length + 1).fill(0);
        for (let i = 0; i <= shorter.length; i++) {
            costs[i] = i;
        }

        for (let i = 1; i <= longer.length; i++) {
            costs[0] = i;
            let nw = i - 1;
            for (let j = 1; j <= shorter.length; j++) {
                const cj = Math.min(
                    costs[j] + 1,
                    costs[j - 1] + 1,
                    nw + (longer.charAt(i - 1) === shorter.charAt(j - 1) ? 0 : 1)
                );
                nw = costs[j];
                costs[j] = cj;
            }
        }

        // Converter distância em similaridade (1 - distância normalizada)
        return 1.0 - (costs[shorter.length] / Math.max(longer.length, 1));
    }
}

/**
 * Implementação de detector de ciclo baseado em padrões de repetição
 */
export class PatternBasedCycleDetector implements CycleDetector {
    private minPatternLength: number;
    private maxPatternLength: number;
    private logger: Logger;

    constructor(minPatternLength = 2, maxPatternLength = 5) {
        this.minPatternLength = minPatternLength;
        this.maxPatternLength = maxPatternLength;
        this.logger = Logger.getInstance();
    }

    /**
     * Detecta ciclos baseado em padrões de repetição
     */
    public detectCycles(thoughts: string[], newThought: string): boolean {
        // Precisamos de pelo menos 2 * minPatternLength pensamentos para detectar um padrão
        if (thoughts.length < 2 * this.minPatternLength) {
            return false;
        }

        // Adicionar o novo pensamento à lista para análise
        const allThoughts = [...thoughts, newThought];

        // Verificar padrões de repetição de diferentes tamanhos
        for (let patternLength = this.minPatternLength; patternLength <= this.maxPatternLength; patternLength++) {
            if (allThoughts.length < 2 * patternLength) {
                continue; // Não temos pensamentos suficientes para este comprimento de padrão
            }

            // Verificar se os últimos patternLength pensamentos repetem os anteriores
            const lastPattern = allThoughts.slice(-patternLength);
            const previousPattern = allThoughts.slice(-2 * patternLength, -patternLength);

            // Verificar similaridade entre os padrões
            let patternMatched = true;
            for (let i = 0; i < patternLength; i++) {
                const similarityDetector = new SimilarityBasedCycleDetector(0.7); // Limiar mais baixo para comparação de padrões
                if (!similarityDetector.detectCycles([previousPattern[i]], lastPattern[i])) {
                    patternMatched = false;
                    break;
                }
            }

            if (patternMatched) {
                this.logger.info('Ciclo detectado baseado em padrão de repetição', {
                    patternLength,
                    pattern: lastPattern.map(t => t.substring(0, 50) + '...')
                });
                return true;
            }
        }

        return false;
    }
}

/**
 * Detector de ciclos composto que combina múltiplos detectores
 */
export class CompositeCycleDetector implements ICycleDetector {
    private detectors: CycleDetector[];
    private logger: Logger;

    constructor(detectors: CycleDetector[] = []) {
        this.detectors = detectors.length > 0 ?
            detectors :
            [
                new SimilarityBasedCycleDetector(),
                new PatternBasedCycleDetector()
            ];
        this.logger = Logger.getInstance();
    }

    /**
     * Adiciona um detector ao composto
     */
    public addDetector(detector: CycleDetector): void {
        this.detectors.push(detector);
    }

    /**
     * Detecta ciclos usando todos os detectores configurados
     */
    public detectCycles(thoughts: string[], newThought: string): boolean {
        for (const detector of this.detectors) {
            if (detector.detectCycles(thoughts, newThought)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calcula a similaridade entre duas strings
     * Delega para o primeiro detector de similaridade disponível
     */
    public calculateSimilarity(a: string, b: string): number {
        // Delega para o detector de similaridade, se disponível
        for (const detector of this.detectors) {
            if (detector instanceof SimilarityBasedCycleDetector) {
                return detector.calculateSimilarity(a, b);
            }
        }

        // Se não houver detectores baseados em similaridade, use o detector padrão
        const defaultDetector = new SimilarityBasedCycleDetector();
        return defaultDetector.calculateSimilarity(a, b);
    }
}

/**
 * Fábrica para criar detectores de ciclo
 */
export class CycleDetectorFactory {
    public static createDetector(options: number | { algorithm?: string; threshold?: number } = 0.8): ICycleDetector {
        // Tratamento de compatibilidade para permitir uso com número direto (threshold) ou objeto de opções
        let threshold = 0.8;

        if (typeof options === 'number') {
            threshold = options;
        } else if (typeof options === 'object') {
            threshold = options.threshold || 0.8;
        }

        return new CompositeCycleDetector([
            new SimilarityBasedCycleDetector(threshold),
            new PatternBasedCycleDetector()
        ]);
    }
} 