# Guia de Instalação - Premier Organizer

Plugin UXP para Adobe Premiere Pro que automatiza a organização de mídias na timeline.

---

## Requisitos

- **Adobe Premiere Pro 25.1+** (versão 2025 ou superior)
- **UXP Developer Tool (UDT)**

---

## Instalação

### 1. Instalar o UXP Developer Tool

1. Abra a **Creative Cloud Desktop**
2. Vá em **Stock & Marketplace** → **Plugins**
3. Busque por **"UXP Developer Tool"**
4. Clique em **Instalar**

### 2. Carregar o Plugin no Premiere

1. Abra o **Adobe Premiere Pro**
2. Abra o **UXP Developer Tool** (aplicativo separado)
3. No UDT, clique em **"Add Plugin"**
4. Navegue até a pasta `Premier Organizer/build/`
5. Selecione o arquivo `manifest.json`
6. Clique em **"Load"** ao lado do plugin carregado

✅ O painel aparecerá em **Window → Extensions → Premier Organizer**

---

## Como Usar

### Passo 1: Preparar os Bins

Organize seus arquivos no painel **Project** do Premiere:

```
📁 Projeto
├── 📁 Videos
│   ├── (TAKE 1) cena_praia.mp4
│   ├── (TAKE 2) cena_cidade.mp4
│   └── (TAKE 3) cena_montanha.mp4
└── 📁 Imagens
    ├── (TAKE 1) foto_praia.jpg
    ├── (TAKE 2) foto_cidade.png
    └── (TAKE 3) foto_montanha.jpg
```

> ⚠️ **Importante**: Use o formato `(TAKE N)` no início do nome do arquivo para agrupar takes correspondentes.

### Passo 2: Configurar o Plugin

1. Abra **Window → Extensions → Premier Organizer**
2. **Selecione os Bins**: escolha o bin de vídeos e o de imagens
3. **Configure o Padrão de Intercalação**:
   - `V,I` = 1 vídeo, 1 imagem (alternado)
   - `2V,1I` = 2 vídeos, 1 imagem
   - `VVI` = 2 vídeos, 1 imagem (formato compacto)
4. **Configure as Durações**: defina o tempo mínimo e máximo para corte aleatório dos vídeos

### Passo 3: Executar

1. Crie ou abra uma **Sequence** no Premiere
2. Clique em **"Organizar Timeline"**
3. O plugin insere automaticamente as mídias seguindo o padrão configurado

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Plugin não aparece no menu | Verifique se o Premiere é versão 25.1 ou superior |
| Erro ao carregar no UDT | Certifique-se de selecionar o `manifest.json` dentro da pasta `build/` |
| "No active sequence" | Crie ou abra uma Sequence antes de executar |
| Takes não são detectados | Use exatamente o formato `(TAKE N)` com parênteses e espaço |
| Bins não aparecem | Certifique-se de ter bins criados no projeto do Premiere |

---

## Para Desenvolvedores

Se precisar modificar o código:

```bash
# Instalar dependências
npm install

# Build de desenvolvimento
npm run build

# Build de produção
npm run build:prod

# Modo watch (rebuild automático)
npm run watch
```

Após alterações, no UDT clique em **"Reload"** para atualizar o plugin.

---

## Suporte

Em caso de problemas, verifique:
1. Versão do Premiere Pro (25.1+)
2. Se o UDT está instalado e aberto
3. Se a pasta `build/` contém os arquivos: `manifest.json`, `index.html`, `index.js`
