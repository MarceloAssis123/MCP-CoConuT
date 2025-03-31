/**
 * Sistema avançado para detecção de ciclos no pensamento
 * Utilizando biblioteca externa para cálculo de similaridade e cache para melhor desempenho
 */

import * as stringSimilarity from 'string-similarity';
import { ICycleDetector } from '../interfaces';
import { SimilarityCache } from '../utils/cache';
import { config } from '../../config';
import { Logger } from '../logger';

/**
 * Detector de ciclos base
 */
export abstract class BaseCycleDetector implements ICycleDetector {
    protected logger: Logger;
    protected similarityCache: SimilarityCache;

    constructor() {
        this.logger = Logger.getInstance();
        this.similarityCache = new SimilarityCache(config.coconut.maxCacheSize);
    }

    /**
     * Detecta ciclos nos pensamentos
     */
    abstract detectCycles(thoughts: string[], newThought: string): boolean;

    /**
     * Calcula similaridade entre duas strings
     */
    abstract calculateSimilarity(a: string, b: string): number;
}

/**
 * Detector de ciclos baseado em similaridade de texto usando Levenshtein
 */
export class LevenshteinSimilarityDetector extends BaseCycleDetector {
    private threshold: number;
    private minThoughts: number;

    constructor(threshold = config.coconut.cycleDetectionThreshold, minThoughts = 4) {
        super();
        this.threshold = threshold;
        this.minThoughts = minThoughts;
    }

    detectCycles(thoughts: string[], newThought: string): boolean {
        if (thoughts.length < this.minThoughts) {
            return false;
        }

        // Verificar similaridade com pensamentos anteriores
        for (let i = 0; i < thoughts.length; i++) {
            const similarity = this.calculateSimilarity(newThought, thoughts[i]);
            if (similarity > this.threshold) {
                this.logger.info('Ciclo detectado baseado em similaridade Levenshtein', {
                    similarity,
                    index: i,
                    threshold: this.threshold
                });
                return true;
            }
        }

        return false;
    }

    calculateSimilarity(a: string, b: string): number {
        // Verificar se já temos o valor em cache
        const cachedSimilarity = this.similarityCache.getSimilarity(a, b, 'levenshtein');
        if (cachedSimilarity !== undefined) {
            return cachedSimilarity;
        }

        // Calcular similaridade usando a biblioteca
        const similarity = stringSimilarity.compareTwoStrings(a, b);

        // Armazenar em cache
        this.similarityCache.setSimilarity(a, b, 'levenshtein', similarity);

        return similarity;
    }
}

/**
 * Detector de ciclos baseado em similaridade Jaccard
 */
export class JaccardSimilarityDetector extends BaseCycleDetector {
    private threshold: number;
    private minThoughts: number;

    constructor(threshold = config.coconut.cycleDetectionThreshold, minThoughts = 4) {
        super();
        this.threshold = threshold;
        this.minThoughts = minThoughts;
    }

    detectCycles(thoughts: string[], newThought: string): boolean {
        if (thoughts.length < this.minThoughts) {
            return false;
        }

        // Verificar similaridade com pensamentos anteriores
        for (let i = 0; i < thoughts.length; i++) {
            const similarity = this.calculateSimilarity(newThought, thoughts[i]);
            if (similarity > this.threshold) {
                this.logger.info('Ciclo detectado baseado em similaridade Jaccard', {
                    similarity,
                    index: i,
                    threshold: this.threshold
                });
                return true;
            }
        }

        return false;
    }

    calculateSimilarity(a: string, b: string): number {
        // Verificar se já temos o valor em cache
        const cachedSimilarity = this.similarityCache.getSimilarity(a, b, 'jaccard');
        if (cachedSimilarity !== undefined) {
            return cachedSimilarity;
        }

        // Implementação do índice de Jaccard
        const setA = new Set(a.toLowerCase().split(/\s+/));
        const setB = new Set(b.toLowerCase().split(/\s+/));

        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        const similarity = intersection.size / union.size;

        // Armazenar em cache
        this.similarityCache.setSimilarity(a, b, 'jaccard', similarity);

        return similarity;
    }
}

/**
 * Detector de ciclos baseado em similaridade de cosseno
 */
export class CosineSimilarityDetector extends BaseCycleDetector {
    private threshold: number;
    private minThoughts: number;

    constructor(threshold = config.coconut.cycleDetectionThreshold, minThoughts = 4) {
        super();
        this.threshold = threshold;
        this.minThoughts = minThoughts;
    }

    detectCycles(thoughts: string[], newThought: string): boolean {
        if (thoughts.length < this.minThoughts) {
            return false;
        }

        // Verificar similaridade com pensamentos anteriores
        for (let i = 0; i < thoughts.length; i++) {
            const similarity = this.calculateSimilarity(newThought, thoughts[i]);
            if (similarity > this.threshold) {
                this.logger.info('Ciclo detectado baseado em similaridade de cosseno', {
                    similarity,
                    index: i,
                    threshold: this.threshold
                });
                return true;
            }
        }

        return false;
    }

    calculateSimilarity(a: string, b: string): number {
        // Verificar se já temos o valor em cache
        const cachedSimilarity = this.similarityCache.getSimilarity(a, b, 'cosine');
        if (cachedSimilarity !== undefined) {
            return cachedSimilarity;
        }

        // Usar a biblioteca string-similarity para calcular (ela usa similaridade de cosseno internamente)
        const similarity = stringSimilarity.compareTwoStrings(a, b);

        // Armazenar em cache
        this.similarityCache.setSimilarity(a, b, 'cosine', similarity);

        return similarity;
    }
}

/**
 * Detector de ciclos baseado em padrões de repetição
 */
export class PatternBasedCycleDetector extends BaseCycleDetector {
    private minPatternLength: number;
    private maxPatternLength: number;
    private similarityDetector: LevenshteinSimilarityDetector;

    constructor(minPatternLength = 2, maxPatternLength = 5) {
        super();
        this.minPatternLength = minPatternLength;
        this.maxPatternLength = maxPatternLength;
        this.similarityDetector = new LevenshteinSimilarityDetector(0.7);
    }

    detectCycles(thoughts: string[], newThought: string): boolean {
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
                if (this.similarityDetector.calculateSimilarity(previousPattern[i], lastPattern[i]) < 0.7) {
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

    calculateSimilarity(a: string, b: string): number {
        return this.similarityDetector.calculateSimilarity(a, b);
    }
}

/**
 * Detector de ciclos composto que combina múltiplos detectores
 */
export class CompositeCycleDetector extends BaseCycleDetector {
    private detectors: ICycleDetector[];

    constructor(detectors: ICycleDetector[] = []) {
        super();
        this.detectors = detectors.length > 0 ? detectors : [];
    }

    addDetector(detector: ICycleDetector): void {
        this.detectors.push(detector);
    }

    detectCycles(thoughts: string[], newThought: string): boolean {
        for (const detector of this.detectors) {
            if (detector.detectCycles(thoughts, newThought)) {
                return true;
            }
        }
        return false;
    }

    calculateSimilarity(a: string, b: string): number {
        // Usar o primeiro detector para cálculo de similaridade ou retornar 0 se não houver detectors
        if (this.detectors.length === 0) {
            return 0;
        }
        return this.detectors[0].calculateSimilarity(a, b);
    }
}

/**
 * Fábrica para criar detectores de ciclo
 */
export class CycleDetectorFactory {
    static createDetector(options: {
        algorithm?: 'levenshtein' | 'jaccard' | 'cosine';
        threshold?: number;
    } = {}): ICycleDetector {
        const composite = new CompositeCycleDetector();
        const algorithm = options.algorithm || 'levenshtein';
        const threshold = options.threshold || 0.8;

        // Adicionar detector baseado em algoritmo configurado
        switch (algorithm) {
            case 'jaccard':
                composite.addDetector(new JaccardSimilarityDetector(threshold));
                break;
            case 'cosine':
                composite.addDetector(new CosineSimilarityDetector(threshold));
                break;
            case 'levenshtein':
            default:
                composite.addDetector(new LevenshteinSimilarityDetector(threshold));
                break;
        }

        // Sempre adicionar detector baseado em padrões
        composite.addDetector(new PatternBasedCycleDetector());

        return composite;
    }
} 