#!/usr/bin/env node

/**
 * Script para preparar o pacote para instalação global via GitHub
 * Este script garante que todas as dependências estejam instaladas,
 * que o código TypeScript seja compilado, e cria uma versão pré-compilada
 * pronta para ser instalada globalmente sem precisar de compilação.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cores para console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

console.log(`${colors.blue}Iniciando preparação do pacote para instalação global...${colors.reset}`);

// Verificar se node_modules existe
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log(`${colors.yellow}Instalando dependências...${colors.reset}`);
    execSync('npm install', { stdio: 'inherit' });
} else {
    console.log(`${colors.green}Dependências já instaladas.${colors.reset}`);
}

// Compilar TypeScript
console.log(`${colors.yellow}Compilando TypeScript...${colors.reset}`);
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log(`${colors.green}Compilação concluída com sucesso!${colors.reset}`);
} catch (error) {
    console.error(`${colors.red}Erro durante a compilação:${colors.reset}`, error.message);
    process.exit(1);
}

// Verificar se a pasta dist foi criada corretamente
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
    console.error(`${colors.red}A pasta dist não foi criada. Verifique a compilação.${colors.reset}`);
    process.exit(1);
}

// Verificar se a pasta bin existe e tem o arquivo server.js
if (!fs.existsSync(path.join(__dirname, 'bin', 'server.js'))) {
    console.error(`${colors.red}O arquivo bin/server.js não existe. Verifique a estrutura do projeto.${colors.reset}`);
    process.exit(1);
}

// Verificar se o .gitignore não está bloqueando a pasta dist
try {
    const gitignoreContent = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
    if (gitignoreContent.includes('\ndist\n') || gitignoreContent.includes('\ndist') || gitignoreContent.includes('dist\n')) {
        console.warn(`${colors.yellow}⚠️  A pasta dist pode estar sendo ignorada no .gitignore. Verifique se a linha "dist" está comentada ou removida.${colors.reset}`);
    } else {
        console.log(`${colors.green}✓ A pasta dist não está sendo ignorada no .gitignore.${colors.reset}`);
    }
} catch (error) {
    console.warn(`${colors.yellow}Não foi possível verificar o .gitignore: ${error.message}${colors.reset}`);
}

// Criar um README para a versão pré-compilada
console.log(`${colors.blue}Verificando README.md...${colors.reset}`);
if (!fs.existsSync(path.join(__dirname, 'README.md'))) {
    console.warn(`${colors.yellow}README.md não encontrado, criando um básico...${colors.reset}`);
    const basicReadme = `# MCP-CoConuT (Continuous Chain of Thought)

Implementação de um servidor MCP (Model Context Protocol) que disponibiliza a ferramenta CoConuT.

## Instalação Global

\`\`\`bash
npm install -g github:MarceloAssis123/MCP-CoConuT
\`\`\`

## Uso

Após a instalação global, você pode executar o servidor a partir de qualquer diretório usando o comando:

\`\`\`bash
mcp-coconut
\`\`\`
`;
    fs.writeFileSync(path.join(__dirname, 'README.md'), basicReadme, 'utf8');
}

// Verificar e criar arquivo LICENSE se não existir
console.log(`${colors.blue}Verificando arquivo LICENSE...${colors.reset}`);
if (!fs.existsSync(path.join(__dirname, 'LICENSE'))) {
    console.warn(`${colors.yellow}Arquivo LICENSE não encontrado, criando licença MIT básica...${colors.reset}`);
    const year = new Date().getFullYear();
    const mitLicense = `MIT License

Copyright (c) ${year} MCP-CoConuT

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
    fs.writeFileSync(path.join(__dirname, 'LICENSE'), mitLicense, 'utf8');
}

console.log(`${colors.green}====================================${colors.reset}`);
console.log(`${colors.green}Pacote preparado com sucesso!${colors.reset}`);
console.log(`${colors.blue}Agora você pode:${colors.reset}`);
console.log(`${colors.blue}1. Fazer commit das alterações (incluindo a pasta dist compilada)${colors.reset}`);
console.log(`${colors.blue}2. Fazer push para o GitHub${colors.reset}`);
console.log(`${colors.blue}3. Instalar globalmente usando:${colors.reset}`);
console.log(`${colors.yellow}   npm install -g github:MarceloAssis123/MCP-CoConuT${colors.reset}`);
console.log(`${colors.green}====================================${colors.reset}`); 