#!/usr/bin/env node

/**
 * Script para preparar o pacote para instalação global via GitHub
 * Este script garante que todas as dependências estejam instaladas
 * e que o código TypeScript seja compilado antes do push para o GitHub.
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

console.log(`${colors.green}====================================${colors.reset}`);
console.log(`${colors.green}Pacote preparado com sucesso!${colors.reset}`);
console.log(`${colors.blue}Agora você pode:${colors.reset}`);
console.log(`${colors.blue}1. Fazer commit das alterações${colors.reset}`);
console.log(`${colors.blue}2. Fazer push para o GitHub${colors.reset}`);
console.log(`${colors.blue}3. Instalar globalmente usando:${colors.reset}`);
console.log(`${colors.yellow}   npm install -g github:MarceloAssis123/MCP-CoConuT${colors.reset}`);
console.log(`${colors.green}====================================${colors.reset}`); 