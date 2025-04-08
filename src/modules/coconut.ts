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
    SavedFileInfo
} from './types';
import { Logger, LogLevel } from './logger';
import { StorageFactory, StorageProvider, MemoryStorageProvider } from './storage';
import { BranchManager } from './branch-manager';
import { ThoughtManager } from './thought-manager';
import { InputManager, InputProcessor, InputSequenceManager } from './input-manager';
import { CoConuT_Storage } from './coconut-storage';
import { AnalyserFactory } from './analyser';

/**
 * Descrições dos parâmetros de entrada da ferramenta CoConuT
 */
export const INPUT_DESCRIPTIONS = {
    thought: "O texto do pensamento atual no processo de raciocínio",
    nextThoughtNeeded: "Indica se é necessário um próximo pensamento (true) ou se a cadeia está concluída (false)",
    thoughtNumber: "Número sequencial deste pensamento na cadeia",
    totalThoughts: "Número total estimado de pensamentos para resolver o problema",
    isRevision: "Indica se este pensamento revisa um pensamento anterior",
    revisesThought: "Número do pensamento que está sendo revisado",
    branchFromThought: "Número do pensamento a partir do qual esta ramificação começa",
    branchId: "Identificador único da ramificação atual",
    needsMoreThoughts: "Indica se o problema precisa de mais pensamentos do que o previsto inicialmente",
    score: "Pontuação ou confiança associada a este pensamento (0-10)",
    inputType: "Tipo de entrada esperada do usuário",
    problemStatus: "Descrição do status atual da resolução do problema",
    options: "Lista de opções para o usuário escolher",
    numberArray: "Array de números fornecido como entrada",
    Call_CoConuT_Analyser: "Indica se o analisador CoConuT_Analyser deve ser chamado"
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
                    message: `Thought cycle detected. Please review your approach and try a new direction.`,
                    analysis: {
                        isOnRightTrack: false,
                        needsMoreUserInfo: true,
                        suggestedTotalThoughts: totalThoughts,
                        suggestions: ['Cycle detected in reasoning. Consider changing the approach to avoid repetitions.']
                    }
                };
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

                // Realizar análise automática em intervalos regulares ou quando solicitado
                // As condições são: a cada 3 interações, na última interação, ou quando explicitamente solicitado
                if (this.interactionCount % this.config.reflectionInterval === 0 ||
                    !nextThoughtNeeded ||
                    Call_CoConuT_Analyser) {

                    const analysisResult = this.runAnalysis();
                    response.analysis = analysisResult;

                    this.logger.info('Análise automática realizada', {
                        interactionCount: this.interactionCount,
                        isOnRightTrack: analysisResult.isOnRightTrack,
                        needsMoreUserInfo: analysisResult.needsMoreUserInfo
                    });
                } else {
                    // Sempre retornar o parâmetro analysis mesmo quando não for usado diretamente
                    response.analysis = {
                        isOnRightTrack: true,
                        needsMoreUserInfo: false,
                        suggestedTotalThoughts: totalThoughts,
                        suggestions: [`Analysis will be automatically executed in the next interaction ${this.interactionCount + 1} of ${this.config.reflectionInterval} or when explicitly requested.`]
                    };

                    this.logger.info('Analysis parameter included with indication of next execution', {
                        interactionCount: this.interactionCount,
                        nextAnalysisAt: this.interactionCount + 1
                    });
                }
            }

            // Se nextThoughtNeeded é false, significa que precisamos finalizar a cadeia
            if (!nextThoughtNeeded) {
                this.logger.info('Thought chain finalized. Use CoConuT_Storage to save with a projectPath.');
            }

            // Registrar automaticamente a interação no arquivo conclusion.md se o caminho do projeto estiver configurado
            if (this.config.projectPath) {
                try {
                    // Importar a classe para evitar erro de ciclo de dependência
                    const { CoConuT_Storage } = require('./coconut-storage');

                    // Criar instância de CoConuT_Storage
                    const coconutStorage = new CoConuT_Storage(this.storageProvider, this.config);

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

        // Executar análise
        return analyser.analyseChainOfThought(thoughts);
    }

    /**
     * Método para salvar os dados com CoConuT_Storage
     * Este método deve ser chamado externamente quando a cadeia termina
     * @param projectPath Caminho do projeto onde os arquivos serão salvos
     * @param whyChange Motivo da mudança
     * @param whatChange Descrição da mudança 
     */
    public async saveWithStorage(projectPath: string, whyChange: string, whatChange: string): Promise<SavedFileInfo[]> {
        try {
            if (!projectPath) {
                throw new Error("You must provide a path to save the files");
            }

            if (!whyChange) {
                throw new Error("You must provide the reason for the change");
            }

            if (!whatChange) {
                throw new Error("You must provide the description of the change");
            }

            // Verificar se temos pensamentos para salvar
            if (this.temporaryThoughts.length === 0) {
                throw new Error("There are no thoughts to save");
            }

            const storageService = new CoConuT_Storage(this.storageProvider, this.config);

            // Processar conclusão e salvar todos os pensamentos
            this.logger.info('Saving thought chain and generating conclusion', {
                thoughtCount: this.temporaryThoughts.length,
                projectPath,
                whyChange,
                whatChange
            });

            const savedFiles = await storageService.processConclusion(
                this.temporaryThoughts,
                projectPath,
                whyChange,
                whatChange
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