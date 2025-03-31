/**
 * Gerenciamento de inputs do usuário usando padrão Observer
 * Permite desacoplar a produção e consumo de eventos de input
 */

import { IInputManager, InputEvent, InputSubscriber } from '../interfaces';
import { Logger } from '../logger';
import { InputType } from '../types';

/**
 * Implementação do gerenciador de input usando padrão Observer
 */
export class InputManager implements IInputManager {
    private subscribers: Map<string, Set<InputSubscriber<any>>>;
    private inputRequired: boolean;
    private currentInputType: string;
    private inputMessage: string;
    private inputOptions: any[];
    private logger: Logger;

    constructor() {
        this.subscribers = new Map();
        this.inputRequired = false;
        this.currentInputType = InputType.TEXT;
        this.inputMessage = '';
        this.inputOptions = [];
        this.logger = Logger.getInstance();
    }

    /**
     * Inscreve um assinante para receber eventos de um tipo específico
     */
    subscribe<T>(type: string, subscriber: InputSubscriber<T>): void {
        if (!this.subscribers.has(type)) {
            this.subscribers.set(type, new Set());
        }

        this.subscribers.get(type)!.add(subscriber);

        this.logger.debug(`Novo assinante registrado para eventos do tipo '${type}'`);
    }

    /**
     * Remove um assinante de eventos de um tipo específico
     */
    unsubscribe<T>(type: string, subscriber: InputSubscriber<T>): void {
        if (!this.subscribers.has(type)) {
            return;
        }

        this.subscribers.get(type)!.delete(subscriber);

        // Limpar conjunto se vazio
        if (this.subscribers.get(type)!.size === 0) {
            this.subscribers.delete(type);
        }

        this.logger.debug(`Assinante removido para eventos do tipo '${type}'`);
    }

    /**
     * Publica um evento para todos os assinantes registrados para o tipo
     */
    publish<T>(type: string, data: T): boolean {
        if (!this.subscribers.has(type) || this.subscribers.get(type)!.size === 0) {
            this.logger.warn(`Nenhum assinante para eventos do tipo '${type}'`);
            return false;
        }

        if (!this.inputRequired) {
            this.logger.warn(`Publicação de evento sem solicitação prévia de input`);
        }

        const event: InputEvent<T> = {
            type,
            data,
            timestamp: Date.now(),
            processed: false
        };

        // Notificar todos os assinantes
        let processed = false;
        this.subscribers.get(type)!.forEach(subscriber => {
            try {
                subscriber.onInput(event);
                processed = true;
                event.processed = true;
            } catch (error) {
                this.logger.error(`Erro ao processar evento por assinante`, { error });
            }
        });

        // Limpar estado se processado com sucesso
        if (processed) {
            this.clearInputRequest();
        }

        this.logger.info(`Evento do tipo '${type}' publicado`, {
            processed,
            subscriberCount: this.subscribers.get(type)!.size
        });

        return processed;
    }

    /**
     * Solicita input do usuário
     */
    requestInput(type: string, message: string, options: any[] = []): void {
        this.inputRequired = true;
        this.currentInputType = type;
        this.inputMessage = message;
        this.inputOptions = options;

        this.logger.info(`Input solicitado: tipo '${type}'`, {
            message,
            hasOptions: options.length > 0
        });
    }

    /**
     * Verifica se input é necessário
     */
    isInputRequired(): boolean {
        return this.inputRequired;
    }

    /**
     * Obtém o tipo de input atual
     */
    getCurrentInputType(): string {
        return this.currentInputType;
    }

    /**
     * Obtém a mensagem de solicitação de input
     */
    getInputMessage(): string {
        return this.inputMessage;
    }

    /**
     * Obtém as opções disponíveis para o input
     */
    getInputOptions(): any[] {
        return [...this.inputOptions];
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
 * Sequenciador de tipos de input para interações estruturadas
 */
export class InputSequencer {
    private sequence: string[];
    private currentIndex: number;
    private logger: Logger;

    constructor(sequence: string[] = []) {
        this.sequence = sequence.length > 0 ? sequence : [
            InputType.TEXT,
            InputType.TEXT,
            InputType.NUMBER_ARRAY,
            InputType.OPTIONS,
            InputType.BOOLEAN
        ];
        this.currentIndex = 0;
        this.logger = Logger.getInstance();
    }

    /**
     * Define uma nova sequência de tipos de input
     */
    setSequence(sequence: string[]): void {
        if (sequence.length === 0) {
            this.logger.warn('Tentativa de definir sequência vazia de inputs');
            return;
        }

        this.sequence = sequence;
        this.currentIndex = 0;

        this.logger.info('Nova sequência de inputs definida', {
            length: sequence.length
        });
    }

    /**
     * Obtém o próximo tipo de input na sequência
     */
    getNextInputType(): string {
        if (this.sequence.length === 0) {
            this.logger.warn('Sequência de inputs vazia');
            return InputType.TEXT;
        }

        const nextType = this.sequence[this.currentIndex];

        // Avançar para o próximo item, com loop
        this.currentIndex = (this.currentIndex + 1) % this.sequence.length;

        return nextType;
    }

    /**
     * Reinicia a sequência
     */
    reset(): void {
        this.currentIndex = 0;
    }
}

/**
 * Validador de input para verificar formatos e restrições
 */
export class InputValidator {
    /**
     * Valida input de texto
     */
    static validateText(input: string, minLength = 0, maxLength = Infinity, pattern?: RegExp): boolean {
        if (typeof input !== 'string') {
            return false;
        }

        if (input.length < minLength || input.length > maxLength) {
            return false;
        }

        if (pattern && !pattern.test(input)) {
            return false;
        }

        return true;
    }

    /**
     * Valida input de array de números
     */
    static validateNumberArray(input: any[], minLength = 0, maxLength = Infinity, min = -Infinity, max = Infinity): boolean {
        if (!Array.isArray(input)) {
            return false;
        }

        if (input.length < minLength || input.length > maxLength) {
            return false;
        }

        return input.every(item =>
            typeof item === 'number' && !isNaN(item) && item >= min && item <= max
        );
    }

    /**
     * Valida input de opções
     */
    static validateOption(input: string, options: string[]): boolean {
        if (typeof input !== 'string') {
            return false;
        }

        return options.includes(input);
    }

    /**
     * Valida input booleano
     */
    static validateBoolean(input: any): boolean {
        return typeof input === 'boolean';
    }
}

/**
 * Classe adaptadora para compatibilidade com o sistema antigo
 */
export class LegacyInputAdapter implements InputSubscriber<any> {
    private processor: any;

    constructor(processor: any) {
        this.processor = processor;
    }

    onInput(event: InputEvent<any>): void {
        const { type, data } = event;

        switch (type) {
            case InputType.TEXT:
                if (this.processor.processTextInput) {
                    this.processor.processTextInput(data);
                }
                break;

            case InputType.NUMBER_ARRAY:
                if (this.processor.processNumberArrayInput) {
                    this.processor.processNumberArrayInput(data);
                }
                break;

            case InputType.OPTIONS:
                if (this.processor.processOptionsInput && Array.isArray(event.data.options)) {
                    this.processor.processOptionsInput(data.selected, data.options);
                }
                break;

            case InputType.BOOLEAN:
                if (this.processor.processBooleanInput) {
                    this.processor.processBooleanInput(data);
                }
                break;
        }
    }
}

/**
 * Fábrica para criar componentes de input
 */
export class InputFactory {
    /**
     * Cria um gerenciador de input
     */
    static createInputManager(): IInputManager {
        return new InputManager();
    }

    /**
     * Cria um sequenciador de input
     */
    static createInputSequencer(sequence?: string[]): InputSequencer {
        return new InputSequencer(sequence);
    }

    /**
     * Cria um adaptador de input legado
     */
    static createLegacyAdapter(processor: any): InputSubscriber<any> {
        return new LegacyInputAdapter(processor);
    }
} 