# MCP-Server com CoConuT (Continuous Chain of Thought)

Implementação de um servidor MCP (Model Context Protocol) que disponibiliza a ferramenta CoConuT para facilitar o pensamento estruturado em cadeia contínua com detecção automática de ciclos, gerenciamento de ramificações e interação guiada.

## Recursos Principais

- **Pensamento Contínuo em Cadeia**: Implementação do CoConuT (Continuous Chain of Thought) para resolução estruturada de problemas
- **Detecção de Ciclos**: Algoritmos avançados para detectar raciocínio cíclico usando diferentes métricas de similaridade (Levenshtein, Jaccard, Cosine)
- **Gerenciamento de Ramificações**: Possibilidade de explorar diferentes linhas de pensamento com ramificações, comparações e mesclagem
- **Reflexão Automática**: Sistema de reflexão periódica para avaliar o progresso na resolução do problema
- **Persistência Opcional**: Capacidade de salvar histórico de pensamentos em arquivos locais
- **Múltiplos Formatos de Resposta**: Suporte para diferentes formatos (JSON, Markdown, HTML)
- **Arquitetura Modular**: Sistema baseado em componentes com injeção de dependências

## Requisitos

- Node.js 18 ou superior
- NPM

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/seu-usuario/MCP-servers.git
cd MCP-servers
npm install
```

## Configuração

O sistema utiliza um objeto de configuração centralizado em `src/config.ts`. Os valores padrão são:

### Configuração do CoConuT
- `maxHistorySize`: Tamanho máximo do histórico (padrão: 1000)
- `cycleDetectionThreshold`: Limiar para detecção de ciclos (padrão: 0.8)
- `persistenceEnabled`: Ativar persistência (padrão: false)
- `storageFilePath`: Caminho para armazenamento (padrão: './coconut-data' ou definido pelo usuário)
- `maxBranches`: Número máximo de ramificações (padrão: 10)
- `reflectionInterval`: Intervalo de reflexão em pensamentos (padrão: 3)
- `similarityAlgorithm`: Algoritmo de similaridade (padrão: 'levenshtein', opções: 'jaccard', 'cosine')
- `enableSimilarityCache`: Ativar cache de similaridade (padrão: true)
- `maxCacheSize`: Tamanho máximo do cache (padrão: 1000)

### Configuração do Servidor
- `name`: Nome do servidor
- `version`: Versão do servidor (padrão: '1.0.0')
- `transport`: Tipo de transporte (fixo como 'stdio')

### Configuração de Logs
- `minLevel`: Nível mínimo de logs (padrão: 'info', opções: 'debug', 'warn', 'error')
- `enableConsole`: Logs no console (padrão: true)
- `includeTimestamp`: Incluir timestamp nos logs (padrão: true)
- `logFilePath`: Caminho para arquivo de log (opcional)

## Uso

Para desenvolvimento:

```bash
npm run dev
```

Para produção:

```bash
npm run build
npm start
```

## Ferramentas Disponíveis

O servidor MCP expõe as seguintes ferramentas:

### CoConuT

Implementação principal da ferramenta CoConuT que retorna respostas em formato JSON.

### CoConuT-MD

Variante que retorna respostas em formato Markdown.

### CoConuT-HTML

Variante que retorna respostas em formato HTML estruturado.

## Arquitetura

O projeto utiliza uma arquitetura modular com injeção de dependências:

- **index.ts**: Ponto de entrada que configura o servidor MCP
- **config.ts**: Configuração centralizada
- **modules/**
  - **coconut/**: Implementação principal do CoConuT
  - **branch/**: Gerenciamento de ramificações
  - **cycle-detector/**: Detecção de ciclos no pensamento
  - **input/**: Sistema de gerenciamento de inputs
  - **formatters/**: Formatadores de resposta
  - **utils/**: Utilitários compartilhados
- **logger.ts**: Sistema de logging
- **storage.ts**: Persistência de dados
- **factory.ts**: Fábrica para criação de componentes
- **types.ts**: Definições de tipos e interfaces

## Contribuindo

Contribuições são bem-vindas! Por favor, siga os passos:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Implemente sua feature com testes
4. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
5. Push para a branch (`git push origin feature/nova-funcionalidade`)
6. Abra um Pull Request

## Licença

Este projeto está licenciado sob a [Licença MIT](LICENSE). 