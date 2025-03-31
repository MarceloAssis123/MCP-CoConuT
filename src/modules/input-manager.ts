/**
 * Gerenciamento de inputs do usuário
 */

import { InputType } from './types';
import { Logger } from './logger';

/**
 * Interface para callbacks de processamento de input
 */
export interface InputProcessor {
    processTextInput(input: string): void;
    processNumberArrayInput(input: number[]): void;
    processOptionsInput(selectedOption: string, options: string[]): void;
    processBooleanInput(input: boolean): void;
}

/**
 * Classe para gerenciar inputs do usuário
 */
export class InputManager {
    private inputRequired: boolean = false;
    private currentInputType: InputType = InputType.TEXT;
    private inputProcessor: InputProcessor | null = null;
    private inputOptions: string[] = [];
    private inputMessage: string = '';
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * Define o processador de inputs
     */
    public setInputProcessor(processor: InputProcessor): void {
        this.inputProcessor = processor;
    }

    /**
     * Verifica se input é necessário
     */
    public isInputRequired(): boolean {
        return this.inputRequired;
    }

    /**
     * Obtém o tipo de input atual
     */
    public getCurrentInputType(): InputType {
        return this.currentInputType;
    }

    /**
     * Obtém a mensagem de solicitação de input
     */
    public getInputMessage(): string {
        return this.inputMessage;
    }

    /**
     * Obtém as opções disponíveis (para input do tipo OPTIONS)
     */
    public getInputOptions(): string[] {
        return [...this.inputOptions];
    }

    /**
     * Solicita input do usuário
     */
    public requestInput(
        inputType: InputType = InputType.TEXT,
        message: string = 'Por favor, forneça sua entrada:',
        options: string[] = []
    ): void {
        this.inputRequired = true;
        this.currentInputType = inputType;
        this.inputMessage = message;
        this.inputOptions = options;

        this.logger.info('Input do usuário solicitado', {
            inputType,
            message,
            hasOptions: options.length > 0
        });
    }

    /**
     * Processa o input recebido do usuário
     */
    public processInput(input: any): boolean {
        if (!this.inputRequired) {
            this.logger.warn('Tentativa de processar input sem solicitação prévia');
            return false;
        }

        if (!this.inputProcessor) {
            this.logger.error('Nenhum processador de input definido');
            this.clearInputRequest();
            return false;
        }

        try {
            switch (this.currentInputType) {
                case InputType.TEXT:
                    if (typeof input === 'string') {
                        this.inputProcessor.processTextInput(input);
                    } else {
                        this.logger.warn('Tipo de input inválido para TEXT', { receivedType: typeof input });
                        return false;
                    }
                    break;

                case InputType.NUMBER_ARRAY:
                    if (Array.isArray(input) && input.every(item => typeof item === 'number')) {
                        this.inputProcessor.processNumberArrayInput(input);
                    } else {
                        this.logger.warn('Tipo de input inválido para NUMBER_ARRAY', { receivedType: typeof input });
                        return false;
                    }
                    break;

                case InputType.OPTIONS:
                    if (typeof input === 'string' && this.inputOptions.includes(input)) {
                        this.inputProcessor.processOptionsInput(input, this.inputOptions);
                    } else {
                        this.logger.warn('Opção inválida selecionada', {
                            receivedOption: input,
                            validOptions: this.inputOptions
                        });
                        return false;
                    }
                    break;

                case InputType.BOOLEAN:
                    if (typeof input === 'boolean') {
                        this.inputProcessor.processBooleanInput(input);
                    } else {
                        this.logger.warn('Tipo de input inválido para BOOLEAN', { receivedType: typeof input });
                        return false;
                    }
                    break;

                default:
                    this.logger.error('Tipo de input desconhecido', { inputType: this.currentInputType });
                    return false;
            }

            this.logger.info('Input do usuário processado com sucesso', {
                inputType: this.currentInputType
            });

            this.clearInputRequest();
            return true;
        } catch (error) {
            this.logger.error('Erro ao processar input do usuário', {
                error,
                inputType: this.currentInputType
            });

            this.clearInputRequest();
            return false;
        }
    }

    /**
     * Limpa a solicitação de input atual
     */
    private clearInputRequest(): void {
        this.inputRequired = false;
        this.inputMessage = '';
        this.inputOptions = [];
    }
}

/**
 * Classe para sequenciamento automático de tipos de input
 */
export class InputSequenceManager {
    private sequence: InputType[] = [];
    private currentIndex: number = 0;
    private logger: Logger;

    constructor(sequence: InputType[] = []) {
        this.sequence = sequence.length > 0 ? sequence : [
            InputType.TEXT,
            InputType.TEXT,
            InputType.NUMBER_ARRAY,
            InputType.OPTIONS,
            InputType.BOOLEAN
        ];
        this.logger = Logger.getInstance();
    }

    /**
     * Define uma nova sequência de tipos de input
     */
    public setSequence(sequence: InputType[]): void {
        if (sequence.length === 0) {
            this.logger.warn('Tentativa de definir sequência vazia de inputs');
            return;
        }

        this.sequence = [...sequence];
        this.currentIndex = 0;
        this.logger.debug('Nova sequência de inputs definida', {
            sequenceLength: this.sequence.length
        });
    }

    /**
     * Obtém o próximo tipo de input na sequência
     */
    public getNextInputType(): InputType {
        const inputType = this.sequence[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.sequence.length;
        return inputType;
    }

    /**
     * Reinicia a sequência
     */
    public reset(): void {
        this.currentIndex = 0;
    }
} 