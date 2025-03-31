/**
 * Sistema de logger para monitorar o funcionamento do CoConuT
 */

// Tipos de logs
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

// Interface para configuração do logger
export interface LoggerConfig {
    minLevel: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    logFilePath?: string;
    includeTimestamp: boolean;
}

// Configuração padrão
const DEFAULT_CONFIG: LoggerConfig = {
    minLevel: LogLevel.INFO,
    enableConsole: true,
    enableFile: false,
    includeTimestamp: true
};

/**
 * Classe Logger para registrar informações sobre o funcionamento do sistema
 */
export class Logger {
    private config: LoggerConfig;
    private static instance: Logger;

    private constructor(config: Partial<LoggerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Obtém a instância singleton do logger
     */
    public static getInstance(config?: Partial<LoggerConfig>): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }

    /**
     * Atualiza a configuração do logger
     */
    public updateConfig(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Formata a mensagem de log
     */
    private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): string {
        const timestamp = this.config.includeTimestamp ? `[${new Date().toISOString()}] ` : '';
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `${timestamp}[${level}] ${message}${contextStr}`;
    }

    /**
     * Registra uma mensagem se o nível for adequado
     */
    private log(level: LogLevel, message: string, context?: Record<string, any>): void {
        // Verificar se o nível do log é adequado
        const levels = Object.values(LogLevel);
        if (levels.indexOf(level) < levels.indexOf(this.config.minLevel)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, context);

        // Registrar no console se habilitado
        if (this.config.enableConsole) {
            switch (level) {
                case LogLevel.ERROR:
                    console.error(formattedMessage);
                    break;
                case LogLevel.WARN:
                    console.warn(formattedMessage);
                    break;
                case LogLevel.INFO:
                    console.info(formattedMessage);
                    break;
                default:
                    console.log(formattedMessage);
            }
        }

        // Registrar em arquivo se habilitado (implementação simplificada)
        if (this.config.enableFile && this.config.logFilePath) {
            // Implementação real requer acesso a arquivo, seria implementado aqui
            // utilizando fs.appendFileSync ou similar
        }
    }

    // Métodos públicos para diferentes níveis de log
    public debug(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, context);
    }

    public info(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, context);
    }

    public warn(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, context);
    }

    public error(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, context);
    }
} 