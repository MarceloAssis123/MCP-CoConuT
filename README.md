# Servidor MCP Básico

Este é um servidor básico para o Model Context Protocol (MCP) implementado em TypeScript.

## Funcionalidades

- Um recurso de exemplo (`custom://hello`) que retorna uma mensagem simples
- Uma ferramenta de exemplo (`echo`) que repete o texto fornecido como entrada
- Um prompt de exemplo (`cumprimento`) que gera uma mensagem de saudação personalizada

## Configuração no Cursor IDE

Para usar este servidor MCP no Cursor IDE, adicione a seguinte configuração ao arquivo `mcp.json` na pasta `.cursor` do seu usuário:

```json
{
  "mcpServers": {
    "mcp-custom": {
      "command": "npx",
      "args": [
        "-y",
        "github:SEU-USUARIO/MCP-servers"
      ]
    }
  }
}
```

Substitua `SEU-USUARIO` pelo seu nome de usuário no GitHub.

## Recursos Disponíveis

### 1. Recurso: `custom://hello`

Um recurso de texto simples que retorna uma mensagem de exemplo.

### 2. Ferramenta: `echo`

Uma ferramenta que aceita um parâmetro `texto` e retorna o mesmo texto.

Exemplo de uso:
```json
{
  "tool": "echo",
  "arguments": {
    "texto": "Olá Mundo!"
  }
}
```

### 3. Prompt: `cumprimento`

Um prompt que gera uma mensagem de saudação personalizada para um nome fornecido.

Exemplo de uso:
```json
{
  "prompt": "cumprimento",
  "arguments": {
    "nome": "João"
  }
}
```

## Desenvolvimento Local

### Requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install
```

### Compilar e executar

```bash
# Compilar o código TypeScript
npm run build

# Executar o servidor
npm start
```

O servidor será iniciado na porta 5678.

## Estrutura do Projeto

```
.
├── src/
│   └── index.ts        # Implementação do servidor MCP
├── bin/
│   └── server.js       # Ponto de entrada executável
├── package.json        # Dependências e scripts
└── tsconfig.json       # Configuração do TypeScript
```

## Próximos Passos

- Adicionar autenticação
- Implementar mais recursos e ferramentas
- Conectar a fontes de dados externas 