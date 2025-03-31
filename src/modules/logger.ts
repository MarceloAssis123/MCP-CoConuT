/**
 * Sistema de logger para monitorar o funcionamento do CoConuT
 */

import { ILogger } from "./interfaces";

/**
 * Níveis de log
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Opções de configuração para o logger
 */
export interface LoggerOptions {
    minLevel?: LogLevel;
    enableConsole?: boolean;
    includeTimestamp?: boolean;
    logFilePath?: string;
}

/**
 * Implementação do sistema de log
 */
export class Logger implements ILogger {
    private static instance: Logger;
    private minLevel: LogLevel;
    private enableConsole: boolean;
    private includeTimestamp: boolean;
    private logFilePath?: string;

    /**
     * Construtor privado para implementar Singleton
     */
    private constructor(options: LoggerOptions = {}) {
        this.minLevel = options.minLevel !== undefined ? options.minLevel : LogLevel.INFO;
        this.enableConsole = options.enableConsole !== undefined ? options.enableConsole : true;
        this.includeTimestamp = options.includeTimestamp !== undefined ? options.includeTimestamp : true;
        this.logFilePath = options.logFilePath;
    }

    /**
     * Converte um nome de nível de log para o valor correspondente
     */
    public static getLevelFromName(levelName: string): LogLevel {
        switch (levelName.toLowerCase()) {
            case 'debug':
                return LogLevel.DEBUG;
            case 'info':
                return LogLevel.INFO;
            case 'warn':
                return LogLevel.WARN;
            case 'error':
                return LogLevel.ERROR;
            default:
                return LogLevel.INFO;
        }
    }

    /**
     * Obtém ou cria a instância do logger
     */
    public static getInstance(options?: LoggerOptions): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(options);
        } else if (options) {
            // Atualizar configurações se fornecidas
            Logger.instance.minLevel = options.minLevel !== undefined ? options.minLevel : Logger.instance.minLevel;
            Logger.instance.enableConsole = options.enableConsole !== undefined ? options.enableConsole : Logger.instance.enableConsole;
            Logger.instance.includeTimestamp = options.includeTimestamp !== undefined ? options.includeTimestamp : Logger.instance.includeTimestamp;
            Logger.instance.logFilePath = options.logFilePath !== undefined ? options.logFilePath : Logger.instance.logFilePath;
        }
        return Logger.instance;
    }

    /**
     * Loga uma mensagem de depuração
     */
    public debug(message: string, meta: Record<string, any> = {}): void {
        this.log(LogLevel.DEBUG, message, meta);
    }

    /**
     * Loga uma mensagem informativa
     */
    public info(message: string, meta: Record<string, any> = {}): void {
        this.log(LogLevel.INFO, message, meta);
    }

    /**
     * Loga um aviso
     */
    public warn(message: string, meta: Record<string, any> = {}): void {
        this.log(LogLevel.WARN, message, meta);
    }

    /**
     * Loga um erro
     */
    public error(message: string, meta: Record<string, any> = {}): void {
        this.log(LogLevel.ERROR, message, meta);
    }

    /**
     * Método central de logging
     */
    private log(level: LogLevel, message: string, meta: Record<string, any> = {}): void {
        if (level < this.minLevel) {
            return;
        }

        const timestamp = this.includeTimestamp ? new Date().toISOString() : '';
        const levelName = LogLevel[level];

        let logMessage = '';
        if (this.includeTimestamp) {
            logMessage += `[${timestamp}] `;
        }
        logMessage += `[${levelName}] ${message}`;

        // Adicionar metadados se existirem
        if (Object.keys(meta).length > 0) {
            try {
                logMessage += ` ${JSON.stringify(meta)}`;
            } catch (e) {
                logMessage += ` [Meta: serializarão falhou]`;
            }
        }

        // Saída para console
        if (this.enableConsole) {
            switch (level) {
                case LogLevel.ERROR:
                    console.error(logMessage);
                    break;
                case LogLevel.WARN:
                    console.warn(logMessage);
                    break;
                case LogLevel.INFO:
                    console.info(logMessage);
                    break;
                default:
                    console.log(logMessage);
            }
        }

        // Aqui poderia ter uma implementação para log em arquivo
        // if (this.logFilePath) { ... }
    }
} 