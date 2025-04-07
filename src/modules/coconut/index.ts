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
    InputEvent
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
    private initialized: boolean = false;

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
        responseFormatter?: IResponseFormatter
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
            this.logger.info('Inicializando CoConuT Service');

            // Inicializar componentes em ordem
            await this.storageProvider.initialize();
            await this.branchManager.initialize();

            if ('initialize' in this.thoughtManager) {
                await this.thoughtManager.initialize();
            }

            this.initialized = true;
            this.logger.info('CoConuT Service inicializado com sucesso');
        } catch (error: any) {
            this.logger.error('Erro ao inicializar CoConuT Service', { error });
            throw new Error(`Falha ao inicializar CoConuT: ${error?.message || 'Erro desconhecido'}`);
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
                options
            } = params;

            // Processar input do usuário se disponível
            await this.handleUserInput(params);

            // Gerenciar ramificações
            await this.manageBranches(params);

            // Atualizar status do problema se fornecido
            this.updateProblemStatus(params);

            // Detectar ciclos no raciocínio
            const hasCycle = this.thoughtManager.detectCycle(thought);

            // Adicionar pensamento ao histórico
            await this.addThought(params);

            // Preparar e retornar resposta
            return this.generateResponse(params, hasCycle);
        } catch (error: any) {
            this.logger.error('Erro ao processar requisição CoConuT', { error });

            // Retornar erro em formato compatível
            return {
                thoughtNumber: params.thoughtNumber,
                totalThoughts: params.totalThoughts,
                nextThoughtNeeded: false,
                error: error?.message || 'Erro desconhecido'
            };
        }
    }

    /**
     * Valida os parâmetros recebidos
     */
    private validateParams(params: CoConuTParams): void {
        // Validações específicas
        if (!params.thought) {
            throw new Error('Pensamento não pode estar vazio');
        }

        if (params.thoughtNumber <= 0) {
            throw new Error('Número do pensamento deve ser positivo');
        }

        if (params.totalThoughts < 3) {
            throw new Error('Mínimo de 3 pensamentos necessários');
        }

        // Validações adicionais
        if (params.isRevision && !params.revisesThought) {
            throw new Error('Pensamento de revisão deve especificar qual pensamento está sendo revisado');
        }

        if (params.branchFromThought && !params.branchId) {
            throw new Error('Ao criar uma ramificação, é necessário especificar o ID');
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
            nextThoughtNeeded
        };

        // Adicionar pontos de reflexão se necessário
        this.addReflectionPoints(response, thoughtNumber, totalThoughts);

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

            // Verificar se precisamos solicitar input do usuário
            if (reflectionPoints.needsUserInput) {
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
                    "Por favor, forneça um array de números relevantes para o problema."
                );

                response.action = "REQUEST_INPUT";
                response.inputType = "NUMBER_ARRAY";
                response.message = "Por favor, forneça um array de números relevantes para o problema.";
                break;

            case InputType.OPTIONS:
                const options = ["Continuar no caminho atual", "Explorar nova ramificação", "Revisar pensamentos anteriores"];

                this.inputManager.requestInput(
                    InputType.OPTIONS,
                    "Selecione uma das opções para prosseguir:",
                    options
                );

                response.action = "REQUEST_INPUT";
                response.inputType = "OPTIONS";
                response.message = "Selecione uma das opções para prosseguir:";
                response.options = options;
                break;

            case InputType.BOOLEAN:
                this.inputManager.requestInput(
                    InputType.BOOLEAN,
                    "Responda com verdadeiro ou falso:"
                );

                response.action = "REQUEST_INPUT";
                response.inputType = "BOOLEAN";
                response.message = "Responda com verdadeiro ou falso:";
                break;

            case InputType.TEXT:
            default:
                this.inputManager.requestInput(
                    InputType.TEXT,
                    "Por favor, forneça informações adicionais:"
                );

                response.action = "REQUEST_INPUT";
                response.inputType = "TEXT";
                response.message = "Por favor, forneça informações adicionais:";
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
            this.logger.info('Todos os dados foram limpos');
        } catch (error: any) {
            this.logger.error('Erro ao limpar dados', { error });
            throw new Error(`Falha ao limpar dados: ${error?.message || 'Erro desconhecido'}`);
        }
    }

    /**
     * Manipula eventos de input
     */
    public onInput(event: InputEvent<any>): void {
        const { type, data } = event;

        this.logger.info(`Evento de input recebido: ${type}`, { data });

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

    // Criar e retornar serviço
    return new CoConuTService(
        logger,
        storageProvider,
        inputManager,
        branchManager,
        thoughtManager,
        cycleDetector,
        responseFormatter
    );
} 