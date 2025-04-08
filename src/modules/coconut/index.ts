/**
 * Módulo principal do CoConuT - Continuous Chain of Thought
 * Refatorado para usar injeção de dependências e métodos mais focados
 */

import {
    ILogger,
    IStorageProvider,
    IInputManager,
    IBranchManager,
    IThoughtManager,
    ICycleDetector,
    IResponseFormatter,
    InputSubscriber,
    InputEvent,
    ICoConuTAnalyser
} from '../interfaces';
import { componentFactory } from '../factory';
import {
    CoConuTParams,
    CoConuTResponse,
    InputType
} from '../types';

/**
 * Configuração para o serviço CoConuT
 */
export interface CoConuTServiceConfig {
    responseFormat?: string;
}

/**
 * Serviço principal do CoConuT
 * Implementa o processamento de solicitações e gerencia componentes
 */
export class CoConuTService implements InputSubscriber<any> {
    private logger: ILogger;
    private storageProvider: IStorageProvider;
    private branchManager: IBranchManager;
    private thoughtManager: IThoughtManager;
    private cycleDetector: ICycleDetector;
    private inputManager: IInputManager;
    private responseFormatter: IResponseFormatter;
    private analyser: ICoConuTAnalyser;
    private initialized: boolean = false;
    private interactionCount: number = 0;

    /**
     * Construtor com injeção de dependências
     */
    constructor(
        logger?: ILogger,
        storageProvider?: IStorageProvider,
        inputManager?: IInputManager,
        branchManager?: IBranchManager,
        thoughtManager?: IThoughtManager,
        cycleDetector?: ICycleDetector,
        responseFormatter?: IResponseFormatter,
        analyser?: ICoConuTAnalyser
    ) {
        // Criar componentes necessários ou usar os fornecidos
        this.logger = logger || componentFactory.createLogger();
        this.storageProvider = storageProvider || componentFactory.createStorageProvider();
        this.inputManager = inputManager || componentFactory.createInputManager();

        // As dependências a seguir requerem outras dependências
        if (!branchManager) {
            this.branchManager = componentFactory.createBranchManager(this.storageProvider);
        } else {
            this.branchManager = branchManager;
        }

        this.cycleDetector = cycleDetector || componentFactory.createCycleDetector();

        if (!thoughtManager) {
            this.thoughtManager = componentFactory.createThoughtManager(
                this.storageProvider,
                this.branchManager,
                this.cycleDetector
            );
        } else {
            this.thoughtManager = thoughtManager;
        }

        this.responseFormatter = responseFormatter || componentFactory.createResponseFormatter();

        // Inicializar o analisador
        this.analyser = analyser || componentFactory.createCoConuTAnalyser();

        // Configurar gerenciamento de inputs
        this.setupInputHandling();
    }

    /**
     * Configura o gerenciamento de inputs
     */
    private setupInputHandling(): void {
        // Registrar para receber eventos de input
        this.inputManager.subscribe(InputType.TEXT, this);
        this.inputManager.subscribe(InputType.NUMBER_ARRAY, this);
        this.inputManager.subscribe(InputType.OPTIONS, this);
        this.inputManager.subscribe(InputType.BOOLEAN, this);
    }

    /**
     * Inicializa o serviço e seus componentes
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.logger.info('Initializing CoConuT Service');

            // Inicializar componentes em ordem
            await this.storageProvider.initialize();
            await this.branchManager.initialize();

            if ('initialize' in this.thoughtManager) {
                await this.thoughtManager.initialize();
            }

            this.initialized = true;
            this.logger.info('CoConuT Service initialized successfully');
        } catch (error: any) {
            this.logger.error('Error initializing CoConuT Service', { error });
            throw new Error(`Failed to initialize CoConuT: ${error?.message || 'Unknown error'}`);
        }
    }

    /**
     * Processa uma solicitação para a ferramenta CoConuT
     */
    public async processRequest(params: CoConuTParams): Promise<CoConuTResponse> {
        try {
            // Inicializar se ainda não inicializado
            if (!this.initialized) {
                await this.initialize();
            }

            // Incrementar contador de interações
            this.interactionCount++;

            // Validar parâmetros
            this.validateParams(params);

            // Extrair parâmetros principais
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

            // Processar input do usuário se disponível
            await this.handleUserInput(params);

            // Gerenciar ramificações
            await this.manageBranches(params);

            // Atualizar status do problema se fornecido
            this.updateProblemStatus(params);

            // Detectar ciclos no raciocínio
            const hasCycle = this.thoughtManager.detectCycle(thought);

            // Variável para controlar se devemos forçar a análise
            let forceAnalysis = false;

            // Se houver ciclo, forçar a análise
            if (hasCycle) {
                forceAnalysis = true;
            }

            // Adicionar pensamento ao histórico
            await this.addThought(params);

            // Preparar resposta base
            const response = this.generateResponse(params, hasCycle);

            // Verificar se deve executar a análise
            // A análise é executada quando:
            // 1. O parâmetro Call_CoConuT_Analyser é true, ou
            // 2. A cada 3 interações, ou
            // 3. Na última interação (quando nextThoughtNeeded é false)
            // 4. Critérios adicionais por meio do método shouldPerformAnalysis
            const shouldAnalyse = this.shouldPerformAnalysis(params, hasCycle);

            if (shouldAnalyse || Call_CoConuT_Analyser || forceAnalysis) {
                // Executar análise e adicionar resultados à resposta
                this.logger.info('Executing analysis of thought chain');
                response.analysis = this.runAnalysis();

                // Reset do contador de interações quando a análise é executada
                if (this.interactionCount % 3 === 0) {
                    this.interactionCount = 0;
                }
            } else {
                // When analysis is not executed, include a message indicating when it will be called again
                const nextInteraction = 3 - (this.interactionCount % 3);
                response.analysis = {
                    isOnRightTrack: true,
                    needsMoreUserInfo: false,
                    suggestedTotalThoughts: params.totalThoughts,
                    suggestions: [`Analysis will be automatically executed in ${nextInteraction} interaction(s) or when explicitly requested via Call_CoConuT_Analyser parameter.`]
                };

                this.logger.info('Analysis not executed, added indication of next execution', {
                    interactionCount: this.interactionCount,
                    nextAnalysisIn: nextInteraction
                });
            }

            return response;
        } catch (error: any) {
            this.logger.error('Error processing CoConuT request', { error });

            // Retornar erro em formato compatível
            return {
                thoughtNumber: params.thoughtNumber,
                totalThoughts: params.totalThoughts,
                nextThoughtNeeded: false,
                error: error?.message || 'Unknown error',
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
     * Valida os parâmetros recebidos
     */
    private validateParams(params: CoConuTParams): void {
        // Validações específicas
        if (!params.thought) {
            throw new Error('Thought cannot be empty');
        }

        if (params.thoughtNumber <= 0) {
            throw new Error('Thought number must be positive');
        }

        if (params.totalThoughts < 3) {
            throw new Error('Minimum of 3 thoughts required');
        }

        // Validações adicionais
        if (params.isRevision && !params.revisesThought) {
            throw new Error('Revision thought must specify which thought is being revised');
        }

        if (params.branchFromThought && !params.branchId) {
            throw new Error('When creating a branch, it is necessary to specify the ID');
        }
    }

    /**
     * Processa input do usuário
     */
    private async handleUserInput(params: CoConuTParams): Promise<void> {
        if (!this.inputManager.isInputRequired()) {
            return;
        }

        const { numberArray, options } = params;
        const currentInputType = this.inputManager.getCurrentInputType();

        switch (currentInputType) {
            case InputType.NUMBER_ARRAY:
                if (numberArray) {
                    this.inputManager.publish(InputType.NUMBER_ARRAY, numberArray);
                }
                break;
            case InputType.OPTIONS:
                if (options && options.length > 0) {
                    this.inputManager.publish(InputType.OPTIONS, {
                        selected: options[0],
                        options: options
                    });
                }
                break;
            case InputType.BOOLEAN:
                if (typeof params.nextThoughtNeeded === 'boolean') {
                    this.inputManager.publish(InputType.BOOLEAN, params.nextThoughtNeeded);
                }
                break;
            case InputType.TEXT:
            default:
                if (params.thought) {
                    this.inputManager.publish(InputType.TEXT, params.thought);
                }
                break;
        }
    }

    /**
     * Gerencia ramificações
     */
    private async manageBranches(params: CoConuTParams): Promise<void> {
        const { branchFromThought, branchId } = params;

        if (branchFromThought && branchId && branchId !== this.branchManager.getCurrentBranch()) {
            const branchExists = this.branchManager.getAllBranches().includes(branchId);

            if (branchExists) {
                // Mudar para ramificação existente
                this.branchManager.switchBranch(branchId);
            } else {
                // Criar nova ramificação
                await this.branchManager.createBranch(branchId, branchFromThought);
                this.branchManager.switchBranch(branchId);
            }
        }
    }

    /**
     * Atualiza o status do problema
     */
    private updateProblemStatus(params: CoConuTParams): void {
        if (params.problemStatus) {
            this.thoughtManager.setProblemStatus(params.problemStatus);
        }
    }

    /**
     * Adiciona um pensamento ao histórico
     */
    private async addThought(params: CoConuTParams): Promise<void> {
        const {
            thought,
            thoughtNumber,
            isRevision = false,
            revisesThought,
            score = 0
        } = params;

        await this.thoughtManager.addThought(
            thought,
            thoughtNumber,
            isRevision,
            revisesThought,
            score
        );
    }

    /**
     * Gera a resposta da solicitação
     */
    private generateResponse(params: CoConuTParams, hasCycle: boolean): CoConuTResponse {
        const {
            thoughtNumber,
            totalThoughts,
            nextThoughtNeeded
        } = params;

        // Preparar resposta base
        const response: CoConuTResponse = {
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

        // Tratar detecção de ciclos
        if (hasCycle) {
            response.action = "CYCLE_DETECTED";
            response.message = "Cycle detected in reasoning. Consider a different approach.";
        } else {
            // Adicionar pontos de reflexão apenas se não houver ciclos
            this.addReflectionPoints(response, thoughtNumber, totalThoughts);
        }

        return response;
    }

    /**
     * Adiciona pontos de reflexão à resposta
     */
    private addReflectionPoints(response: CoConuTResponse, thoughtNumber: number, totalThoughts: number): void {
        const reflectionPoints = this.thoughtManager.generateReflectionPoints(
            thoughtNumber,
            totalThoughts
        );

        if (reflectionPoints) {
            response.action = "REFLECTION";

            // Verificação mais segura da propriedade needsUserInput
            if (reflectionPoints.needsUserInput === true) {
                this.requestUserInput(response);
            }
        }
    }

    /**
     * Solicita input do usuário
     */
    private requestUserInput(response: CoConuTResponse): void {
        // Determinar o próximo tipo de input
        const nextInputType = this.getNextInputType();

        // Configurar solicitação
        switch (nextInputType) {
            case InputType.NUMBER_ARRAY:
                this.inputManager.requestInput(
                    InputType.NUMBER_ARRAY,
                    "Please provide relevant numbers for the problem."
                );

                response.action = "REQUEST_INPUT";
                response.inputType = "NUMBER_ARRAY";
                response.message = "Please provide relevant numbers for the problem.";
                break;

            case InputType.OPTIONS:
                const options = ["Continue on current path", "Explore new branch", "Review previous thoughts"];

                this.inputManager.requestInput(
                    InputType.OPTIONS,
                    "Select one of the options to proceed:",
                    options
                );

                response.action = "REQUEST_INPUT";
                response.inputType = "OPTIONS";
                response.message = "Select one of the options to proceed:";
                response.options = options;
                break;

            case InputType.BOOLEAN:
                this.inputManager.requestInput(
                    InputType.BOOLEAN,
                    "Answer with true or false:"
                );

                response.action = "REQUEST_INPUT";
                response.inputType = "BOOLEAN";
                response.message = "Answer with true or false:";
                break;

            case InputType.TEXT:
            default:
                this.inputManager.requestInput(
                    InputType.TEXT,
                    "Please provide additional information:"
                );

                response.action = "REQUEST_INPUT";
                response.inputType = "TEXT";
                response.message = "Please provide additional information:";
                break;
        }
    }

    /**
     * Obtém o próximo tipo de input
     */
    private getNextInputType(): string {
        // Rotação simples entre tipos de input
        const types = [InputType.TEXT, InputType.NUMBER_ARRAY, InputType.OPTIONS, InputType.BOOLEAN];
        const currentIndex = types.indexOf(this.inputManager.getCurrentInputType() as InputType);
        const nextIndex = (currentIndex + 1) % types.length;
        return types[nextIndex];
    }

    /**
     * Limpa todos os dados
     */
    public async clearAllData(): Promise<void> {
        try {
            await this.storageProvider.clear();
            await this.branchManager.clearBranches();
            await this.initialize(); // Reinicializar com dados limpos
            this.logger.info('All data has been cleared');
        } catch (error: any) {
            this.logger.error('Error clearing data', { error });
            throw new Error(`Failed to clear data: ${error?.message || 'Unknown error'}`);
        }
    }

    /**
     * Manipula eventos de input
     */
    public onInput(event: InputEvent<any>): void {
        const { type, data } = event;

        this.logger.info(`Input event received: ${type}`, { data });

        // O processamento específico pode ser feito aqui
        // Note que geralmente não fazemos nada aqui porque o processamento
        // ocorre quando fazemos a próxima chamada para processRequest
    }

    /**
     * Define o formato de resposta
     */
    public setResponseFormat(format: string): void {
        this.responseFormatter = componentFactory.createResponseFormatter(format);
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
        const isRegularInterval = this.interactionCount % 3 === 0;

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
        // Obter todos os pensamentos da branch atual
        const thoughts = this.thoughtManager.getThoughtsForBranch(this.branchManager.getCurrentBranch());

        // Executar análise e enriquecer o resultado
        const result = this.analyser.analyseChainOfThought(thoughts);

        // Adicionar sugestões úteis para o usuário
        if (result.suggestions) {
            // Verificar se já existe sugestão sobre o parâmetro Call_CoConuT_Analyser
            const hasAnalyserSuggestion = result.suggestions.some(
                s => s.includes('Call_CoConuT_Analyser')
            );

            // Adicionar se ainda não existir
            if (!hasAnalyserSuggestion) {
                result.suggestions.push(
                    'You can explicitly request analysis at any point by setting the Call_CoConuT_Analyser parameter to true.'
                );
            }
        }

        return result;
    }
}

/**
 * Cria uma instância do serviço CoConuT
 */
export function createCoConuTService(config: CoConuTServiceConfig = {}): CoConuTService {
    const { responseFormat = 'json' } = config;

    // Criar componentes necessários
    const logger = componentFactory.createLogger();
    const storageProvider = componentFactory.createStorageProvider();
    const inputManager = componentFactory.createInputManager();
    const branchManager = componentFactory.createBranchManager(storageProvider);
    const cycleDetector = componentFactory.createCycleDetector();
    const thoughtManager = componentFactory.createThoughtManager(
        storageProvider,
        branchManager,
        cycleDetector
    );
    const responseFormatter = componentFactory.createResponseFormatter(responseFormat);
    const analyser = componentFactory.createCoConuTAnalyser();

    // Criar e retornar serviço
    return new CoConuTService(
        logger,
        storageProvider,
        inputManager,
        branchManager,
        thoughtManager,
        cycleDetector,
        responseFormatter,
        analyser
    );
} 