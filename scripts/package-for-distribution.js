#!/usr/bin/env node

/**
 * Script para criar pacote de distribuição do Premier Organizer
 * Gera um ZIP pronto para enviar à equipe
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const PACKAGE_NAME = 'Premier-Organizer-Plugin';

console.log('📦 Criando pacote de distribuição...\n');

// 1. Garantir que o build existe
console.log('1. Verificando build...');
if (!fs.existsSync(path.join(ROOT, 'build', 'manifest.json'))) {
    console.log('   Build não encontrado. Executando npm run build...');
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
}
console.log('   ✅ Build OK\n');

// 2. Criar pasta dist se não existir
console.log('2. Preparando pasta de distribuição...');
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
}
fs.mkdirSync(DIST_DIR);

const packageDir = path.join(DIST_DIR, PACKAGE_NAME);
fs.mkdirSync(packageDir);
console.log('   ✅ Pasta criada\n');

// 3. Copiar arquivos necessários
console.log('3. Copiando arquivos...');

// Copiar pasta build
const buildSrc = path.join(ROOT, 'build');
const buildDest = path.join(packageDir, 'build');
fs.cpSync(buildSrc, buildDest, { recursive: true });
console.log('   ✅ build/');

// Copiar INSTALL.md
fs.copyFileSync(
    path.join(ROOT, 'INSTALL.md'),
    path.join(packageDir, 'INSTALL.md')
);
console.log('   ✅ INSTALL.md');

// 4. Criar README rápido
const quickReadme = `# Premier Organizer - Plugin para Premiere Pro

## Instalação Rápida

1. Instale o "UXP Developer Tool" pela Creative Cloud
2. Abra o Premiere Pro
3. Abra o UXP Developer Tool
4. Clique em "Add Plugin" → selecione build/manifest.json
5. Clique em "Load"
6. Acesse: Window → Extensions → Premier Organizer

📖 Instruções detalhadas: veja INSTALL.md
`;

fs.writeFileSync(path.join(packageDir, 'LEIA-ME.txt'), quickReadme);
console.log('   ✅ LEIA-ME.txt\n');

// 5. Criar ZIP
console.log('4. Criando arquivo ZIP...');
const zipName = `${PACKAGE_NAME}.zip`;
const zipPath = path.join(DIST_DIR, zipName);

// Remover zip antigo se existir
if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
}

// Criar zip usando comando do sistema
execSync(`cd "${DIST_DIR}" && zip -r "${zipName}" "${PACKAGE_NAME}"`, { stdio: 'pipe' });
console.log(`   ✅ ${zipName}\n`);

// 6. Limpar pasta temporária
fs.rmSync(packageDir, { recursive: true });

// 7. Resultado final
const stats = fs.statSync(zipPath);
const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

console.log('═══════════════════════════════════════════════════');
console.log('✅ PACOTE CRIADO COM SUCESSO!');
console.log('═══════════════════════════════════════════════════');
console.log(`📁 Arquivo: dist/${zipName}`);
console.log(`📊 Tamanho: ${sizeMB} MB`);
console.log('');
console.log('Envie este arquivo para sua equipe.');
console.log('Eles só precisam extrair e seguir o LEIA-ME.txt');
console.log('═══════════════════════════════════════════════════\n');
