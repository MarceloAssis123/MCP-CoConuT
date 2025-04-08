# MCP-Server com CoConuT (Continuous Chain of Thought)

Implementação de um servidor MCP (Model Context Protocol) que disponibiliza a ferramenta CoConuT para facilitar o pensamento estruturado em cadeia contínua com detecção automática de ciclos, gerenciamento de ramificações e interação guiada.

## Recursos Principais

- **Pensamento Contínuo em Cadeia**: Implementação do CoConuT (Continuous Chain of Thought) para resolução estruturada de problemas
- **Detecção de Ciclos**: Algoritmos avançados para detectar raciocínio cíclico usando diferentes métricas de similaridade (Levenshtein, Jaccard, Cosine)
- **Gerenciamento de Ramificações**: Possibilidade de explorar diferentes linhas de pensamento com ramificações, comparações e mesclagem
- **Reflexão Automática**: Sistema de reflexão periódica para avaliar o progresso na resolução do problema
- **Análise de Pensamentos**: Análise automatizada da cadeia de pensamentos para verificar se o raciocínio está no caminho correto
- **Registro de Conclusões**: Sistema para documentar conclusões e mudanças realizadas de forma estruturada
- **Persistência Integrada**: Todos os dados são automaticamente persistidos para facilitar análise posterior
- **Múltiplos Formatos de Resposta**: Suporte para diferentes formatos (JSON, Markdown, HTML)
- **Arquitetura Modular**: Sistema baseado em componentes com injeção de dependências
- **Documentação Integrada**: Descrições detalhadas dos parâmetros de entrada incluídas na resposta
- **Internacionalização**: Suporte a mensagens em múltiplos idiomas 
- **Sistema de Templates**: Templates flexíveis para personalização das conclusões

## Requisitos

- Node.js 18 ou superior
- NPM

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/MarceloAssis123/MCP-servers.git
cd MCP-servers
npm install
```

Ou use diretamente via npx:

```bash
npx -y github:MarceloAssis123/MCP-servers
```

## Configuração

O sistema utiliza um objeto de configuração centralizado em `src/config.ts`. Os valores padrão são:

### Configuração do CoConuT
- `maxHistorySize`: Tamanho máximo do histórico (padrão: 1000)
- `cycleDetectionThreshold`: Limiar para detecção de ciclos (padrão: 0.8)
- `persistenceEnabled`: Persistência sempre ativada (true)
- `maxBranches`: Número máximo de ramificações (padrão: 10)
- `reflectionInterval`: Intervalo de reflexão em pensamentos (padrão: 3)
- `similarityAlgorithm`: Algoritmo de similaridade (padrão: 'levenshtein', opções: 'jaccard', 'cosine')
- `enableSimilarityCache`: Ativar cache de similaridade (padrão: true)
- `maxCacheSize`: Tamanho máximo do cache (padrão: 1000)

### Parâmetros da Ferramenta CoConuT

A ferramenta CoConuT aceita os seguintes parâmetros de entrada:

- `thought`: O texto do pensamento atual no processo de raciocínio
- `nextThoughtNeeded`: Indica se é necessário um próximo pensamento (true) ou se a cadeia está concluída (false)
- `thoughtNumber`: Número sequencial deste pensamento na cadeia
- `totalThoughts`: Número total estimado de pensamentos para resolver o problema (mínimo de 3 pensamentos obrigatório)
- `isRevision`: Indica se este pensamento revisa um pensamento anterior
- `revisesThought`: Número do pensamento que está sendo revisado
- `branchFromThought`: Número do pensamento a partir do qual esta ramificação começa
- `branchId`: Identificador único da ramificação atual
- `needsMoreThoughts`: Indica se o problema precisa de mais pensamentos do que o previsto inicialmente
- `score`: Pontuação ou confiança associada a este pensamento (0-10)
- `inputType`: Tipo de entrada esperada do usuário
- `problemStatus`: Descrição do status atual da resolução do problema
- `options`: Lista de opções para o usuário escolher
- `numberArray`: Array de números fornecido como entrada
- `Call_CoConuT_Analyser`: Indica se o analisador de cadeia de pensamentos deve ser chamado

### Parâmetros da Ferramenta CoConuT_Analyser

A ferramenta CoConuT_Analyser permite analisar a cadeia de pensamentos atual:

- `thoughts`: Array contendo os pensamentos a serem analisados
- `userQuery`: Consulta original do usuário para verificar alinhamento
- `projectPath`: Caminho do projeto para contexto adicional

### Parâmetros da Ferramenta CoConuT_Storage

A ferramenta CoConuT_Storage permite salvar conclusões estruturadas:

- `projectPath`: Caminho absoluto para o diretório do projeto onde os arquivos serão salvos
- `WhyChange`: Explica por que a mudança foi necessária ou o que motivou a ação
- `WhatChange`: Descreve o que foi modificado ou implementado
- `category`: Categoria principal da mudança (feature, bugfix, refactoring, etc.)
- `subCategories`: Subcategorias para classificação mais específica
- `tags`: Tags para melhorar a busca e classificação das mudanças
- `impactLevel`: Nível de impacto da mudança no sistema (low, medium, high)
- `affectedFiles`: Lista de arquivos afetados pela mudança
- `codeSnippets`: Snippets de código mostrando as mudanças feitas
- `relatedConclusions`: IDs de conclusões relacionadas
- `ticketReference`: Referência a um ticket/issue em um sistema de rastreamento
- `businessContext`: Contexto de negócio explicando o valor da mudança
- `technicalContext`: Contexto técnico adicional sobre a arquitetura afetada
- `alternativesConsidered`: Alternativas consideradas e motivos de rejeição
- `testingPerformed`: Descrição de testes realizados para validar a mudança

### Armazenamento de Dados

Os dados são sempre persistidos e os arquivos são salvos em uma pasta chamada `coconut-data` no caminho fornecido pelo modelo através do parâmetro `projectPath`. É importante que o modelo forneça um caminho absoluto válido para garantir o correto armazenamento dos dados.

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

### Exemplos de Uso

#### Usando CoConuT

Para iniciar uma cadeia de pensamentos:

```json
{
  "thought": "Primeiro passo na análise do problema...",
  "thoughtNumber": 1,
  "totalThoughts": 5,
  "nextThoughtNeeded": true
}
```

#### Usando CoConuT_Analyser

Para analisar a cadeia de pensamentos:

```json
{
  "thoughts": [
    {"thought": "Primeiro pensamento...", "thoughtNumber": 1}, 
    {"thought": "Segundo pensamento...", "thoughtNumber": 2}
  ],
  "userQuery": "Pergunta original do usuário"
}
```

#### Usando CoConuT_Storage

Para salvar uma conclusão:

```json
{
  "projectPath": "/caminho/absoluto/do/projeto",
  "WhyChange": "Motivo da mudança",
  "WhatChange": "Descrição da mudança",
  "category": "feature",
  "tags": ["api", "performance"]
}
```

## Estrutura da Resposta

A resposta da ferramenta CoConuT inclui:

- `thoughtNumber`: Número do pensamento atual
- `totalThoughts`: Número total de pensamentos estimados para resolver o problema
- `nextThoughtNeeded`: Se é necessário continuar com mais pensamentos
- `analysis`: Resultados da análise da cadeia de pensamentos (quando executada)
- `branches`: Lista de todas as ramificações disponíveis
- `currentBranch`: Ramificação atual
- `thoughtHistoryLength`: Tamanho do histórico de pensamentos
- `hasCycle`: Indica se foi detectado um ciclo no raciocínio
- `savedFiles`: Informações sobre os arquivos salvos durante a operação
- `inputDescriptions`: Descrições detalhadas de todos os parâmetros de entrada da ferramenta
- Outros campos opcionais como `reflexionPoints`, `action`, `inputType`, `message`, `options`, etc.

## Ferramentas Disponíveis

O servidor MCP expõe as seguintes ferramentas:

### CoConuT

Implementação principal da ferramenta CoConuT que gerencia cadeias de pensamento com detecção automática de ciclos, ramificações e reflexão.

### CoConuT_Analyser

Ferramenta para análise da cadeia de pensamentos que verifica:
- Se o raciocínio está no caminho correto
- Se são necessárias mais informações do usuário
- Se o número estimado de pensamentos é adequado

### CoConuT_Storage

Ferramenta para documentar conclusões e registrar mudanças de forma estruturada:
- Salva conclusões em formato markdown
- Suporta metadados ricos (tags, categorias, impacto)
- Permite referências a código e arquivos
- Facilita busca e contextualização das mudanças

## Arquitetura

O projeto utiliza uma arquitetura modular com injeção de dependências:

- **index.ts**: Ponto de entrada que configura o servidor MCP
- **config.ts**: Configuração centralizada
- **modules/**
  - **coconut/**: Implementação principal do CoConuT
  - **analyser.ts**: Implementação do analisador de cadeia de pensamentos
  - **coconut-storage.ts**: Sistema de geração e armazenamento de conclusões
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