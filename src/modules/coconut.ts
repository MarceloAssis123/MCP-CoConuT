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
    InputType
} from './types';
import { Logger, LogLevel } from './logger';
import { StorageFactory, StorageProvider } from './storage';
import { BranchManager } from './branch-manager';
import { ThoughtManager } from './thought-manager';
import { InputManager, InputProcessor, InputSequenceManager } from './input-manager';

/**
 * Classe principal para implementação do CoConuT
 */
export class CoConuTService implements InputProcessor {
    private config: CoConuTConfig;
    private logger: Logger;
    private storageProvider: StorageProvider;
    private branchManager: BranchManager;
    private thoughtManager: ThoughtManager;
    private inputManager: InputManager;
    private inputSequenceManager: InputSequenceManager;
    private initialized: boolean = false;

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

        // Inicializar componentes
        this.storageProvider = StorageFactory.createProvider(this.config);
        this.branchManager = new BranchManager(this.storageProvider, this.config);
        this.thoughtManager = new ThoughtManager(this.storageProvider, this.branchManager, this.config);

        // Configurar gerenciamento de inputs
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
            this.logger.info('Inicializando CoConuT Service');

            // Inicializar componentes em ordem
            await this.branchManager.initialize();
            await this.thoughtManager.initialize();

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

            // Extrair parâmetros
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
                    this.logger.info('Input do usuário processado', {
                        inputType: this.inputManager.getCurrentInputType()
                    });
                }
            }

            // Gerenciar ramificações
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

            // Atualizar status do problema se fornecido
            if (problemStatus) {
                this.thoughtManager.setProblemStatus(problemStatus);
            }

            // Detectar ciclos no raciocínio
            const hasCycle = this.thoughtManager.detectCycle(thought);

            // Adicionar pensamento ao histórico
            await this.thoughtManager.addThought(
                thought,
                thoughtNumber,
                isRevision,
                revisesThought,
                score
            );

            // Preparar resposta
            const response: CoConuTResponse = {
                thoughtNumber,
                totalThoughts,
                nextThoughtNeeded,
                branches: this.branchManager.getAllBranches(),
                currentBranch: this.branchManager.getCurrentBranch(),
                thoughtHistoryLength: this.thoughtManager.getThoughtHistory().length,
                hasCycle
            };

            // Adicionar pontos de reflexão se necessário
            const reflectionPoints = this.thoughtManager.generateReflectionPoints(
                thoughtNumber,
                totalThoughts
            );

            if (reflectionPoints) {
                // Garantir que o tipo de reflexionPoints corresponda à interface
                response.reflexionPoints = {
                    isProblemBeingSolved: reflectionPoints.isProblemBeingSolved || 'Não foi fornecido status do problema ainda',
                    shouldIncreaseTotalThoughts: Boolean(reflectionPoints.shouldIncreaseTotalThoughts),
                    needsUserInput: Boolean(reflectionPoints.needsUserInput)
                };

                response.action = "REFLECTION";

                // Verificar se precisamos solicitar input do usuário
                if (response.reflexionPoints.needsUserInput) {
                    const inputType = this.inputSequenceManager.getNextInputType();

                    // Configurar solicitação de input
                    switch (inputType) {
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

                        default:
                            // Outros tipos de input
                            break;
                    }
                }
            }

            return response;
        } catch (error: any) {
            this.logger.error('Erro ao processar requisição CoConuT', { error });

            // Retornar erro em formato compatível
            return {
                thoughtNumber: params.thoughtNumber,
                totalThoughts: params.totalThoughts,
                nextThoughtNeeded: false,
                branches: this.branchManager ? this.branchManager.getAllBranches() : ['main'],
                currentBranch: this.branchManager ? this.branchManager.getCurrentBranch() : 'main',
                thoughtHistoryLength: this.thoughtManager ? this.thoughtManager.getThoughtHistory().length : 0,
                hasCycle: false,
                error: error?.message || 'Erro desconhecido'
            };
        }
    }

    /**
     * Valida os parâmetros recebidos
     */
    private validateParams(params: CoConuTParams): void {
        try {
            CoConuTParamsSchema.parse(params);
        } catch (error: any) {
            this.logger.error('Parâmetros inválidos', { error });
            throw new Error(`Parâmetros inválidos: ${error?.message || 'Erro de validação'}`);
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
} 