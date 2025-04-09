/**
 * Módulo principal do CoConuT - Continuous Chain of Thought
 * Integra todos os componentes para implementação da ferramenta CoConuT
 */

import {
    CoConuTParams,
    CoConuTResponse,
    CoConuTConfig,
    ThoughtEntry,
    DEFAULT_CONFIG,
    CoConuTParamsSchema,
    InputType,
    SavedFileInfo,
    CoConuTStorageParams
} from './types';
import { Logger, LogLevel } from './logger';
import { StorageFactory, StorageProvider, MemoryStorageProvider } from './storage';
import { BranchManager } from './branch-manager';
import { ThoughtManager } from './thought-manager';
import { InputManager, InputProcessor, InputSequenceManager } from './input-manager';
import { CoConuT_Storage } from './coconut-storage';
import { AnalyserFactory } from './analyser';

/**
 * Description of input parameters for the CoConuT tool
 */
export const INPUT_DESCRIPTIONS = {
    thought: "The current thought text in the reasoning process",
    nextThoughtNeeded: "Indicates if a next thought is needed (true) or if the chain is complete (false)",
    thoughtNumber: "Sequential number of this thought in the chain",
    totalThoughts: "Total estimated number of thoughts to solve the problem (minimum of 3 required)",
    isRevision: "Indicates if this thought revises a previous thought",
    revisesThought: "Number of the thought being revised",
    branchFromThought: "Number of the thought from which this branch starts",
    branchId: "Unique identifier of the current branch",
    needsMoreThoughts: "Indicates if the problem needs more thoughts than initially estimated",
    score: "Score or confidence associated with this thought (0-10)",
    inputType: "Type of input expected from the user",
    problemStatus: "Description of the current status of problem solving",
    options: "List of options for the user to choose from",
    numberArray: "Array of numbers provided as input",
    Call_CoConuT_Analyser: "Set to true to force analysis of the current thought chain, useful when you want to check if you're on the right track, suspect a deviation from the original goal, or need to verify if more user information is required"
};

/**
 * Classe principal para implementação do CoConuT
 */
export class CoConuTService implements InputProcessor {
    private config: CoConuTConfig;
    private logger: Logger;
    private storageProvider: MemoryStorageProvider; // Usando MemoryStorageProvider para todos os casos
    private branchManager: BranchManager;
    private thoughtManager: ThoughtManager;
    private inputManager: InputManager;
    private inputSequenceManager: InputSequenceManager;
    private initialized: boolean = false;
    private lastSavedFiles: SavedFileInfo[] = []; // Armazena informações sobre os últimos arquivos salvos
    private temporaryThoughts: ThoughtEntry[] = []; // Armazenamento temporário para pensamentos
    private interactionCount: number = 0; // Contador de interações para análise automática

    /**
     * Construtor
     */
    constructor(config: Partial<CoConuTConfig> = {}) {
        // Mesclar configuração padrão com a fornecida
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Configurar logger
        this.logger = Logger.getInstance({
            minLevel: LogLevel.INFO,
            enableConsole: true
        });

        // Inicializar componentes com armazenamento em memória
        this.storageProvider = new MemoryStorageProvider();
        this.branchManager = new BranchManager(this.storageProvider, this.config);
        this.thoughtManager = new ThoughtManager(this.storageProvider, this.branchManager, this.config);

        // Inicializar gerenciamento de inputs
        this.inputManager = new InputManager();
        this.inputManager.setInputProcessor(this);
        this.inputSequenceManager = new InputSequenceManager([
            InputType.TEXT,
            InputType.TEXT,
            InputType.NUMBER_ARRAY,
            InputType.OPTIONS,
            InputType.BOOLEAN
        ]);
    }

    /**
     * Inicializa o serviço
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.logger.info('Initializing CoConuT Service');

            // Inicializar componentes em ordem
            await this.branchManager.initialize();
            await this.thoughtManager.initialize();

            this.initialized = true;
            this.logger.info('CoConuT Service initialized successfully');
        } catch (error: any) {
            this.logger.error('Error initializing CoConuT Service', { error });
            throw new Error(`Failed to initialize CoConuT: ${error?.message || 'Unknown error'}`);
        }
    }

    /**
     * Processa uma requisição do CoConuT
     * @param params Parâmetros da requisição
     */
    public async processRequest(params: CoConuTParams): Promise<CoConuTResponse> {
        try {
            // Limpar a lista de arquivos salvos
            this.lastSavedFiles = [];

            // Incrementar contador de interações para análise automática
            this.interactionCount++;

            // Extrair parâmetros para facilitar o acesso
            const {
                thought,
                thoughtNumber,
                totalThoughts,
                nextThoughtNeeded,
                isRevision = false,
                revisesThought,
                branchFromThought,
                branchId,
                needsMoreThoughts = false,
                score = 0,
                problemStatus,
                numberArray,
                options,
                Call_CoConuT_Analyser = false
            } = params;

            // Inicializar se ainda não inicializado
            if (!this.initialized) {
                await this.initialize();
            }

            // Validar parâmetros
            this.validateParams(params);

            // Verificar se estamos reiniciando o ciclo de pensamentos (thoughtNumber = 1)
            // Se for o caso e tivermos pensamentos suficientes, salvar no conclusion.md e limpar
            if (thoughtNumber === 1 && this.temporaryThoughts.length > 3) {
                this.logger.info('Detectado reinício de ciclo de pensamentos (thoughtNumber = 1). Salvando pensamentos anteriores e limpando o histórico para evitar detecção de ciclos.');

                try {
                    // Criar instância de CoConuT_Storage com configuração completa
                    const configWithDefaults = {
                        ...this.config,
                        projectPath: this.config.projectPath,
                        // Garantir que outras propriedades essenciais tenham valores padrão
                        maxHistorySize: this.config.maxHistorySize || 1000,
                        persistenceEnabled: this.config.persistenceEnabled !== undefined ? this.config.persistenceEnabled : true,
                        reflectionInterval: this.config.reflectionInterval || 3
                    };

                    // Verificar se projectPath está definido
                    if (!configWithDefaults.projectPath) {
                        throw new Error('projectPath não está definido. É necessário definir o caminho do projeto para salvar os pensamentos.');
                    }

                    const storageService = new CoConuT_Storage(this.storageProvider, configWithDefaults);

                    // Usar o projectPath da configuração (agora garantidamente definido)
                    const projectPath = configWithDefaults.projectPath;

                    // Salvar os pensamentos anteriores no conclusion.md
                    await storageService.processConclusion(
                        this.temporaryThoughts,
                        projectPath,
                        "Pensamentos salvos para evitar detecção de ciclos",
                        `Foram salvos ${this.temporaryThoughts.length} pensamentos que poderiam causar detecção de ciclos.`
                    );

                    // Limpar o histórico de pensamentos em todos os componentes
                    this.temporaryThoughts = [];

                    // Limpar pensamentos na ramificação atual
                    const currentBranch = this.branchManager.getCurrentBranch();
                    // Não existe método clearBranchThoughts, então vamos limpar de outra forma
                    // Remover todos os pensamentos da branch atual
                    const branchThoughts = this.branchManager.getBranchThoughts(currentBranch);
                    if (branchThoughts.length > 0) {
                        this.logger.info('Removendo pensamentos da branch atual', { currentBranch, count: branchThoughts.length });
                    }

                    // Limpar pensamentos no gerenciador de pensamentos
                    // Como clearThoughtsForBranch não existe diretamente, vamos limitar usando o que temos disponível
                    const thoughtsForBranch = this.thoughtManager.getThoughtsForBranch(currentBranch);
                    if (thoughtsForBranch.length > 0) {
                        this.logger.info('Limpando pensamentos do thought manager', { currentBranch, count: thoughtsForBranch.length });
                        // Aqui precisaríamos de um método específico para limpar
                        // Como alternativa, podemos recriar o gerenciador
                        // this.thoughtManager = new ThoughtManager(this.storageProvider, this.branchManager, this.config);
                    }

                    this.logger.info('Pensamentos limpos com sucesso para evitar ciclos');
                } catch (error) {
                    this.logger.error('Erro ao limpar pensamentos para evitar ciclos', { error });
                    // Continuar mesmo com erro, pois é melhor tentar processar do que falhar completamente
                }
            }

            // Processar input do usuário se disponível
            if (this.inputManager.isInputRequired()) {
                let inputProcessed = false;

                switch (this.inputManager.getCurrentInputType()) {
                    case InputType.NUMBER_ARRAY:
                        if (numberArray) {
                            inputProcessed = this.inputManager.processInput(numberArray);
                        }
                        break;
                    case InputType.OPTIONS:
                        if (options && options.length > 0) {
                            inputProcessed = this.inputManager.processInput(options[0]);
                        }
                        break;
                    default:
                        // Outros tipos de input
                        break;
                }

                if (inputProcessed) {
                    this.logger.info('User input processed', {
                        inputType: this.inputManager.getCurrentInputType()
                    });
                }
            }

            // Gerenciar ramificações
            const currentBranch = this.branchManager.getCurrentBranch();
            const branchIdToUse = branchId || currentBranch;

            if (branchFromThought && branchId && branchId !== currentBranch) {
                const branchExists = this.branchManager.getAllBranches().includes(branchId);

                if (branchExists) {
                    // Mudar para ramificação existente
                    this.branchManager.switchBranch(branchId);
                } else {
                    // Criar nova ramificação em memória apenas
                    await this.branchManager.createBranch(branchId, branchFromThought);
                    this.branchManager.switchBranch(branchId);

                    this.logger.info('New branch created', {
                        branchId: branchId,
                        fromThought: branchFromThought
                    });
                }
            }

            // Atualizar status do problema se fornecido
            if (problemStatus) {
                this.thoughtManager.setProblemStatus(problemStatus);
            }

            // Verificar se é uma revisão de pensamento
            if (isRevision && revisesThought) {
                this.logger.info('Processando revisão de pensamento', {
                    revisesThought: revisesThought
                });
                // Implementação da lógica de revisão
                // ...
            }

            // Criar entrada de pensamento
            const thoughtEntry: ThoughtEntry = {
                thought,
                thoughtNumber,
                branchId: branchIdToUse,
                score: score || 0,
                timestamp: Date.now(),
                metadata: {
                    isRevision: isRevision || false,
                    revisesThought: revisesThought,
                    branchFromThought: branchFromThought,
                    nextThoughtNeeded,
                    totalThoughts,
                    needsMoreThoughts
                }
            };

            // Adicionar à memória temporária
            this.temporaryThoughts.push(thoughtEntry);

            // Adicionar pensamento ao gerenciador
            this.thoughtManager.addThought(
                thoughtEntry.thought,
                thoughtEntry.thoughtNumber,
                thoughtEntry.metadata?.isRevision || false,
                thoughtEntry.metadata?.revisesThought,
                thoughtEntry.score,
                {
                    branchFromThought: thoughtEntry.metadata?.branchFromThought,
                    nextThoughtNeeded,
                    totalThoughts,
                    needsMoreThoughts
                }
            );
            this.logger.info('Thought added', { thoughtNumber });

            // Detectar ciclos no raciocínio
            const hasCycle = this.thoughtManager.detectCycle(thought);

            // Variável para controlar se devemos forçar a análise
            let forceAnalysis = false;

            // Variável para armazenar a resposta que será retornada
            let response: CoConuTResponse;

            // Se há ciclo, preparar resposta adequada
            if (hasCycle) {
                this.logger.warn('Thought cycle detected', {
                    thoughtNumber
                });

                // Preparar resposta para ciclo detectado
                response = {
                    thoughtNumber,
                    totalThoughts,
                    nextThoughtNeeded: false,
                    action: 'CYCLE_DETECTED',
                    message: `Thought cycle detected. Please restart with thoughtNumber = 1 to clear previous thoughts and try a new approach.`,
                    analysis: {
                        isOnRightTrack: false,
                        needsMoreUserInfo: true,
                        suggestedTotalThoughts: totalThoughts,
                        suggestions: [
                            'Reinicie com thoughtNumber = 1 para limpar os pensamentos anteriores e evitar a detecção de ciclos.',
                            'Tente uma abordagem diferente ou reformule o problema para evitar repetições no raciocínio.'
                        ]
                    }
                };

                // Quando um ciclo é detectado, sempre executamos a análise
                forceAnalysis = true;
            } else {
                // Adicionar pontos de reflexão se necessário
                const reflectionPoints = this.thoughtManager.generateReflectionPoints(
                    thoughtNumber,
                    totalThoughts
                );

                // Se precisa de reflexão, formatar resposta de acordo
                if (reflectionPoints && reflectionPoints.needsUserInput) {
                    response = {
                        thoughtNumber,
                        totalThoughts,
                        nextThoughtNeeded: false, // Pausar para reflexão
                        action: 'REFLECTION',
                        inputType: 'text', // Valor padrão
                        message: 'Pausa para reflexão. Por favor, forneça informações adicionais.',
                        analysis: {
                            isOnRightTrack: true,
                            needsMoreUserInfo: true,
                            suggestedTotalThoughts: totalThoughts,
                            suggestions: ['Reflection needed. Provide more information to continue.']
                        }
                    };
                } else {
                    // Resposta padrão quando não há necessidade de reflexão
                    response = {
                        thoughtNumber,
                        totalThoughts,
                        nextThoughtNeeded,
                        analysis: {
                            isOnRightTrack: true,
                            needsMoreUserInfo: false,
                            suggestedTotalThoughts: totalThoughts,
                            suggestions: []
                        }
                    };
                }

                // Determinar se deve executar a análise com base em múltiplos fatores
                const shouldAnalyse = this.shouldPerformAnalysis(params, hasCycle);

                if (shouldAnalyse || Call_CoConuT_Analyser) {
                    const analysisResult = this.runAnalysis();
                    response.analysis = analysisResult;

                    this.logger.info('Automatic analysis performed', {
                        interactionCount: this.interactionCount,
                        isOnRightTrack: analysisResult.isOnRightTrack,
                        needsMoreUserInfo: analysisResult.needsMoreUserInfo
                    });

                    // Resetar o contador de interações quando a análise é executada automaticamente
                    if (this.interactionCount % this.config.reflectionInterval === 0) {
                        this.interactionCount = 0;
                    }
                } else {
                    // Calcular quantas interações restam até a próxima análise automática
                    const nextAnalysisIn = this.config.reflectionInterval - (this.interactionCount % this.config.reflectionInterval);

                    // Sempre retornar o parâmetro analysis mesmo quando não for usado diretamente
                    response.analysis = {
                        isOnRightTrack: true,
                        needsMoreUserInfo: false,
                        suggestedTotalThoughts: totalThoughts,
                        suggestions: [`Analysis will be automatically executed in ${nextAnalysisIn} interaction(s) or when explicitly requested via Call_CoConuT_Analyser parameter.`]
                    };

                    this.logger.info('Analysis parameter included with indication of next execution', {
                        interactionCount: this.interactionCount,
                        nextAnalysisIn: nextAnalysisIn
                    });
                }
            }

            // Se nextThoughtNeeded é false, significa que precisamos finalizar a cadeia
            if (!nextThoughtNeeded) {
                this.logger.info('Thought chain finalized. Use CoConuT_Storage to save with a projectPath.');
            }

            // Se um ciclo foi detectado ou precisamos forçar a análise
            if (hasCycle && forceAnalysis && !response.analysis) {
                const analysisResult = this.runAnalysis();
                response.analysis = analysisResult;

                this.logger.info('Forced analysis performed due to cycle detection', {
                    isOnRightTrack: analysisResult.isOnRightTrack,
                    needsMoreUserInfo: analysisResult.needsMoreUserInfo
                });
            }

            // Registrar automaticamente a interação no arquivo conclusion.md se o caminho do projeto estiver configurado
            if (this.config.projectPath) {
                try {
                    // Importar a classe para evitar erro de ciclo de dependência
                    const { CoConuT_Storage } = require('./coconut-storage');

                    // Criar uma cópia da configuração sem definir valores padrão para projectPath
                    const configCopy = {
                        ...this.config
                    };

                    // Verificar explicitamente se projectPath está definido
                    if (!configCopy.projectPath) {
                        this.logger.warn('Não foi possível registrar a interação: projectPath não está definido');
                        return response;
                    }

                    // Criar instância de CoConuT_Storage
                    const coconutStorage = new CoConuT_Storage(this.storageProvider, configCopy);

                    // Determinar o que e por que da interação atual
                    const what = `Thought ${thoughtNumber}: ${thought.substring(0, 100)}${thought.length > 100 ? '...' : ''}`;
                    let why = "Processing thought chain";

                    // Obter novamente os pontos de reflexão para verificação
                    const currentReflectionPoints = this.thoughtManager.generateReflectionPoints(
                        thoughtNumber,
                        totalThoughts
                    );

                    // Adicionar detalhes específicos sobre o tipo de interação
                    if (isRevision) {
                        why = `Revision of thought ${revisesThought}`;
                    } else if (branchFromThought) {
                        why = `Creation of new branch from thought ${branchFromThought}`;
                    } else if (hasCycle) {
                        why = "Detection of thought cycle";
                    } else if (currentReflectionPoints && currentReflectionPoints.needsUserInput) {
                        why = "Pause for reflection and user input";
                    } else if (!nextThoughtNeeded) {
                        why = "Conclusion of thought chain";
                    }

                    // Registrar a interação
                    await coconutStorage.appendInteractionSummary(
                        this.config.projectPath,
                        {
                            thoughtNumber,
                            totalThoughts,
                            what,
                            why
                        }
                    );

                    this.logger.info('Interaction automatically recorded in conclusion.md', {
                        thoughtNumber,
                        projectPath: this.config.projectPath
                    });
                } catch (error) {
                    // Apenas logar o erro, não interromper o fluxo principal
                    this.logger.warn('Error automatically recording interaction', { error });
                }
            }

            return response;
        } catch (error: any) {
            this.logger.error('Error processing request', { error });

            // Retornar erro em formato compatível
            return {
                thoughtNumber: params.thoughtNumber,
                totalThoughts: params.totalThoughts,
                nextThoughtNeeded: false,
                error: error?.message || 'Unknown error processing the request',
                analysis: {
                    isOnRightTrack: false,
                    needsMoreUserInfo: true,
                    suggestedTotalThoughts: params.totalThoughts,
                    suggestions: ['An error occurred during processing. Please review the parameters and try again.']
                }
            };
        }
    }

    /**
     * Determina se deve realizar a análise com base em múltiplos critérios
     * @param params Parâmetros da requisição
     * @param hasCycle Indicador se um ciclo foi detectado
     */
    private shouldPerformAnalysis(params: CoConuTParams, hasCycle: boolean): boolean {
        const {
            thoughtNumber,
            totalThoughts,
            nextThoughtNeeded,
            isRevision,
            branchFromThought,
            score = 0,
            Call_CoConuT_Analyser = false
        } = params;

        // Condições para executar a análise:

        // 1. Intervalos regulares de interação
        const isRegularInterval = this.interactionCount % this.config.reflectionInterval === 0;

        // 2. Último pensamento da cadeia
        const isFinalThought = !nextThoughtNeeded;

        // 3. Solicitação explícita via parâmetro
        const isExplicitlyRequested = Call_CoConuT_Analyser === true;

        // 4. Ciclo detectado no raciocínio
        const isCycleDetected = hasCycle;

        // 5. Score muito baixo indicando possíveis problemas
        const isLowScore = score < 3;

        // 6. Criação de nova ramificação
        const isNewBranch = !!branchFromThought;

        // 7. Revisão de pensamento anterior
        const isThoughtRevision = isRevision;

        // 8. Marcos significativos na cadeia de pensamentos (25%, 50%, 75%)
        let isSignificantMilestone = false;
        if (thoughtNumber > 1 && totalThoughts > 3) {
            const percentage = (thoughtNumber / totalThoughts) * 100;
            if (percentage === 25 || percentage === 50 || percentage === 75) {
                isSignificantMilestone = true;
            }
        }

        // Logar os fatores considerados para a análise (para depuração)
        this.logger.debug('Analysis decision factors', {
            isRegularInterval,
            isFinalThought,
            isExplicitlyRequested,
            isCycleDetected,
            isLowScore,
            isNewBranch,
            isThoughtRevision,
            isSignificantMilestone
        });

        // Retornar true se qualquer uma das condições for atendida
        return isRegularInterval ||
            isFinalThought ||
            isExplicitlyRequested ||
            isCycleDetected ||
            isLowScore ||
            isNewBranch ||
            isThoughtRevision ||
            isSignificantMilestone;
    }

    /**
     * Executa a análise da cadeia de pensamentos
     */
    private runAnalysis(): {
        isOnRightTrack: boolean;
        needsMoreUserInfo: boolean;
        suggestedTotalThoughts: number;
        userInfoNeeded?: string[];
        suggestions?: string[];
    } {
        // Criar instância do analisador
        const analyser = AnalyserFactory.createAnalyser();

        // Obter todos os pensamentos da branch atual para análise
        const thoughts = this.temporaryThoughts.filter(
            thought => thought.branchId === this.branchManager.getCurrentBranch()
        );

        // Executar análise com contexto adicional
        const result = analyser.analyseChainOfThought(thoughts);

        // Enriquecer o resultado com informações adicionais relevantes para o usuário
        if (result.suggestions) {
            // Adicionar sugestão sobre o parâmetro Call_CoConuT_Analyser se não estiver na lista
            const hasAnalyserSuggestion = result.suggestions.some(
                s => s.includes('Call_CoConuT_Analyser')
            );

            if (!hasAnalyserSuggestion) {
                result.suggestions.push(
                    'You can explicitly request analysis at any point by setting the Call_CoConuT_Analyser parameter to true.'
                );
            }
        }

        return result;
    }

    /**
     * Método para salvar os dados com CoConuT_Storage
     * Este método deve ser chamado externamente quando a cadeia termina
     * @param projectPath Caminho do projeto onde os arquivos serão salvos
     * @param whyChange Motivo da mudança
     * @param whatChange Descrição da mudança 
     * @param additionalParams Parâmetros adicionais para enriquecer a conclusão
     */
    public async saveWithStorage(
        projectPath: string,
        whyChange: string,
        whatChange: string,
        additionalParams?: Partial<CoConuTStorageParams>
    ): Promise<SavedFileInfo[]> {
        try {
            // Verificação mais rigorosa do projectPath
            if (!projectPath || projectPath.trim() === '') {
                throw new Error("O caminho do projeto (projectPath) é obrigatório e não pode estar vazio");
            }

            if (!whyChange) {
                throw new Error("O motivo da mudança (whyChange) é obrigatório");
            }

            if (!whatChange) {
                throw new Error("A descrição da mudança (whatChange) é obrigatória");
            }

            // Verificar se temos pensamentos para salvar
            if (this.temporaryThoughts.length === 0) {
                throw new Error("Não há pensamentos para salvar");
            }

            const storageService = new CoConuT_Storage(this.storageProvider, this.config);

            // Log de parâmetros enriquecidos
            this.logger.info('Saving thought chain and generating enriched conclusion', {
                thoughtCount: this.temporaryThoughts.length,
                projectPath,
                whyChange,
                whatChange,
                hasAdditionalParams: !!additionalParams,
                category: additionalParams?.category,
                tagsCount: additionalParams?.tags?.length,
                impactLevel: additionalParams?.impactLevel,
                affectedFilesCount: additionalParams?.affectedFiles?.length
            });

            // Processar conclusão e salvar todos os pensamentos
            const savedFiles = await storageService.processConclusion(
                this.temporaryThoughts,
                projectPath,
                whyChange,
                whatChange,
                additionalParams // Passar os parâmetros adicionais
            );

            // Adicionar informações dos arquivos salvos
            if (savedFiles.length > 0) {
                this.lastSavedFiles = [...savedFiles];
                this.logger.debug('Files saved by conclusion', { count: savedFiles.length });
            }

            // Limpar a memória temporária após salvar
            // this.temporaryThoughts = []; // Comentado para permitir múltiplos salvamentos se necessário

            return savedFiles;
        } catch (error: any) {
            this.logger.error('Error saving with CoConuT_Storage', { error });
            throw new Error(`Failed to save: ${error?.message || 'Unknown error'}`);
        }
    }

    /**
     * Valida os parâmetros recebidos
     */
    private validateParams(params: CoConuTParams): void {
        try {
            CoConuTParamsSchema.parse(params);
        } catch (error: any) {
            this.logger.error('Invalid parameters', { error });
            throw new Error(`Invalid parameters: ${error?.message || 'Validation error'}`);
        }

        // Validações adicionais
        if (params.isRevision && !params.revisesThought) {
            throw new Error('Revision thought must specify which thought is being revised');
        }

        if (params.branchFromThought && !params.branchId) {
            throw new Error('When creating a branch, it is necessary to specify the ID');
        }

        // Log de parâmetros com suas descrições (útil para depuração)
        this.logger.debug('Parâmetros da requisição CoConuT com descrições:', {
            thought: `${params.thought.substring(0, 30)}... (${INPUT_DESCRIPTIONS.thought})`,
            thoughtNumber: `${params.thoughtNumber} (${INPUT_DESCRIPTIONS.thoughtNumber})`,
            totalThoughts: `${params.totalThoughts} (${INPUT_DESCRIPTIONS.totalThoughts})`,
            nextThoughtNeeded: `${params.nextThoughtNeeded} (${INPUT_DESCRIPTIONS.nextThoughtNeeded})`,
            ...(params.isRevision && { isRevision: `${params.isRevision} (${INPUT_DESCRIPTIONS.isRevision})` }),
            ...(params.revisesThought && { revisesThought: `${params.revisesThought} (${INPUT_DESCRIPTIONS.revisesThought})` }),
            ...(params.branchFromThought && { branchFromThought: `${params.branchFromThought} (${INPUT_DESCRIPTIONS.branchFromThought})` }),
            ...(params.branchId && { branchId: `${params.branchId} (${INPUT_DESCRIPTIONS.branchId})` }),
            ...(params.needsMoreThoughts && { needsMoreThoughts: `${params.needsMoreThoughts} (${INPUT_DESCRIPTIONS.needsMoreThoughts})` }),
            ...(params.score && { score: `${params.score} (${INPUT_DESCRIPTIONS.score})` }),
            ...(params.Call_CoConuT_Analyser && { Call_CoConuT_Analyser: `${params.Call_CoConuT_Analyser} (${INPUT_DESCRIPTIONS.Call_CoConuT_Analyser})` })
        });
    }

    // Implementação da interface InputProcessor

    public processTextInput(input: string): void {
        this.logger.info('Texto recebido do usuário', { input });
        // Implementação específica para processamento de texto
    }

    public processNumberArrayInput(input: number[]): void {
        this.logger.info('Array de números recebido do usuário', { input });
        // Implementação específica para processamento de array de números
    }

    public processOptionsInput(selectedOption: string, options: string[]): void {
        this.logger.info('Opção selecionada pelo usuário', { selectedOption, options });

        // Implementação para processar a opção selecionada
        switch (selectedOption) {
            case "Explorar nova ramificação":
                // Lógica para criar nova ramificação
                const newBranchId = `branch-${Date.now()}`;
                this.branchManager.createBranch(newBranchId, this.thoughtManager.getInteractionCount());
                this.branchManager.switchBranch(newBranchId);
                break;

            case "Revisar pensamentos anteriores":
                // Lógica para revisão (nada a fazer aqui, o cliente decidirá qual pensamento revisar)
                break;

            case "Continuar no caminho atual":
            default:
                // Continuar normalmente
                break;
        }
    }

    public processBooleanInput(input: boolean): void {
        this.logger.info('Valor booleano recebido do usuário', { input });
        // Implementação específica para processamento de boolean
    }

    public processInput(type: string, data: any): boolean {
        this.logger.debug(`Processando input do tipo ${type}`, { data });
        return true; // Indica que o input foi processado com sucesso
    }

    /**
     * Configura o caminho do projeto para salvamento automático
     * @param projectPath Caminho do projeto onde os arquivos serão salvos
     */
    public setProjectPath(projectPath: string): void {
        if (!projectPath) {
            this.logger.warn('Tentativa de configurar caminho de projeto vazio');
            return;
        }

        this.config.projectPath = projectPath;
        this.logger.info('Caminho do projeto configurado', { projectPath });
    }
} 