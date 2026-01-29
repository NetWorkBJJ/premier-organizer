# Premier Organizer - Product Requirements Document (PRD)

> Plugin UXP para Adobe Premiere Pro que automatiza a organização de mídias na timeline

**Versão**: 1.0
**Data**: Janeiro 2026
**Status**: Em Desenvolvimento

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Pesquisa de Tecnologias](#2-pesquisa-de-tecnologias)
3. [API Reference](#3-api-reference)
4. [Repositórios de Referência](#4-repositórios-de-referência)
5. [Requisitos do Produto](#5-requisitos-do-produto)
6. [Especificações Técnicas](#6-especificações-técnicas)
7. [Arquitetura](#7-arquitetura)
8. [Plano de Implementação](#8-plano-de-implementação)
9. [Limitações e Workarounds](#9-limitações-e-workarounds)
10. [Verificação e Testes](#10-verificação-e-testes)

---

## 1. Visão Geral

### 1.1 Problema

Editores de vídeo que trabalham com mídias geradas por IA enfrentam um processo manual repetitivo:

- **Mídias de IA sempre têm 8 segundos** - falta variação natural
- **Organização manual** - arrastar e ordenar clips um por um
- **Alternância entre tipos** - vídeos e imagens em pastas separadas precisam ser intercalados
- **Nomenclatura sequencial** - arquivos como "(TAKE 1) prompt...", "(TAKE 2) prompt..." precisam ser pareados

### 1.2 Solução

Plugin UXP para Premiere Pro que:

1. **Lê mídias de bins separados** (pasta de vídeos + pasta de imagens)
2. **Detecta automaticamente os Takes** pela nomenclatura `(TAKE N) ...`
3. **Permite padrão customizável** de intercalação (ex: 2 vídeos, 1 imagem)
4. **Aplica cortes aleatórios** de duração (6-8 segundos) para criar variação
5. **Insere automaticamente na timeline** conforme configuração

### 1.3 Decisões do Usuário

| Decisão | Escolha |
|---------|---------|
| Tecnologia | UXP (Unified Extensibility Platform) |
| Fonte de Clips | Bins do projeto (pastas separadas) |
| Nomenclatura | `(TAKE N) Prompt...` - formato fixo |
| Intercalação | Padrão customizável (ex: "2V,1I") |

---

## 2. Pesquisa de Tecnologias

### 2.1 Opções Disponíveis para Automação do Premiere Pro

#### 2.1.1 ExtendScript (Legado)

**Status**: Suportado até setembro 2026 (depois será descontinuado)

**Características**:
- Baseado em ECMAScript 3 (JavaScript de 1999)
- Execução **síncrona** - bloqueia a UI do Premiere durante execução
- API madura com documentação extensa
- Debugger via VS Code com extensão Adobe ExtendScript

**Prós**:
- Documentação completa em [ppro-scripting.docsforadobe.dev](https://ppro-scripting.docsforadobe.dev/)
- Muitos exemplos na comunidade
- Estável e bem testado

**Contras**:
- JavaScript antigo (sem async/await, arrow functions, etc.)
- Bloqueia UI durante execução
- Será descontinuado em 2026
- ExtendScript Toolkit (ESTK) não é mais atualizado

**Exemplo de código**:
```javascript
// ExtendScript - síncrono
var seq = app.project.activeSequence;
var track = seq.videoTracks[0];
track.insertClip(projectItem, 0); // bloqueia UI
```

#### 2.1.2 CEP - Common Extensibility Platform (Legado)

**Status**: Substituído por UXP desde Premiere Pro 25.6. Suporte planejado por 1 ano após UXP.

**Características**:
- Arquitetura híbrida: HTML/CSS/JS (frontend) + ExtendScript (backend)
- Node.js disponível no backend
- Comunicação via bridge (CSInterface.js)
- Baseado em Chromium Embedded Framework

**Arquitetura CEP**:
```
┌─────────────────────────────────────┐
│         CEP Panel (HTML/JS)         │
│  - React/Vue/vanilla JS             │
│  - Node.js runtime                  │
└──────────────┬──────────────────────┘
               │ CSInterface.evalScript()
               ▼
┌─────────────────────────────────────┐
│         ExtendScript Layer          │
│  - Premiere Pro API access          │
│  - Synchronous execution            │
└─────────────────────────────────────┘
```

**Prós**:
- Node.js no backend (npm packages disponíveis)
- UI moderna com frameworks web
- Mais exemplos disponíveis que UXP

**Contras**:
- Comunicação assíncrona complexa via bridge
- ExtendScript ainda bloqueia UI
- Será descontinuado após UXP
- Duas camadas de código para manter

**Instalação de CEP panels**:
- Windows: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions`
- Mac: `/Library/Application Support/Adobe/CEP/extensions`

#### 2.1.3 UXP - Unified Extensibility Platform (RECOMENDADO)

**Status**: Plataforma atual e oficial desde novembro 2025 (Premiere Pro 25.6)

**Características**:
- JavaScript moderno (ES6+)
- Execução **assíncrona** - não bloqueia UI
- Acesso direto às APIs sem bridge
- React e TypeScript suportados nativamente
- Pode ser publicado no Adobe Marketplace

**Arquitetura UXP**:
```
┌─────────────────────────────────────┐
│         UXP Plugin (JS/React)       │
│  - Modern JavaScript (ES6+)         │
│  - Direct API access                │
│  - Async/await native               │
└──────────────┬──────────────────────┘
               │ Direct calls (no bridge)
               ▼
┌─────────────────────────────────────┐
│         Premiere Pro APIs           │
│  - Asynchronous execution           │
│  - Non-blocking UI                  │
└─────────────────────────────────────┘
```

**Prós**:
- JavaScript moderno com async/await
- Não bloqueia UI do Premiere
- Acesso direto sem bridge
- Futuro da extensibilidade Adobe
- TypeScript com tipos oficiais
- Distribuição via Adobe Marketplace

**Contras**:
- Mais novo, menos exemplos na comunidade
- Documentação ainda em evolução
- Requer Premiere Pro 25.6+

**Exemplo de código**:
```typescript
// UXP - assíncrono
const project = await ppro.Project.getActiveProject();
const sequence = await project.getActiveSequence();
const track = await sequence.getVideoTrack(0);
// Não bloqueia UI!
```

### 2.2 Comparativo de Tecnologias

| Aspecto | ExtendScript | CEP | UXP |
|---------|--------------|-----|-----|
| JavaScript | ES3 (1999) | ES5+ (panel) / ES3 (host) | ES6+ |
| Execução | Síncrona | Síncrona (host) | Assíncrona |
| Bloqueia UI | Sim | Sim (host calls) | Não |
| Bridge | Não | Sim (CSInterface) | Não |
| React/TS | Não | Sim (panel only) | Sim |
| Node.js | Não | Sim | Não |
| Status | Até Set 2026 | Descontinuando | Atual |
| Marketplace | Não | Sim | Sim |

### 2.3 Decisão: UXP

**Razões para escolher UXP**:

1. **Futuro garantido** - é a plataforma oficial da Adobe
2. **JavaScript moderno** - async/await, arrow functions, classes
3. **Não bloqueia UI** - melhor experiência do usuário
4. **Sem bridge** - código mais simples e direto
5. **TypeScript** - tipos oficiais disponíveis
6. **React** - framework moderno para UI

---

## 3. API Reference

### 3.1 Estrutura da API UXP Premiere Pro

```
ppro (módulo principal)
├── Project
│   ├── getActiveProject()
│   ├── getAllSequences()
│   ├── getRootItem() → ProjectItem (root bin)
│   └── ...
├── Sequence
│   ├── getVideoTrack(index)
│   ├── getAudioTrack(index)
│   ├── getPlayerPosition()
│   └── ...
├── VideoTrack / AudioTrack
│   ├── getTrackItems()
│   ├── getIndex()
│   ├── isMuted()
│   └── ...
├── VideoClipTrackItem / AudioClipTrackItem
│   ├── getStartTime() / createSetStartAction()
│   ├── getEndTime() / createSetEndAction()
│   ├── getInPoint() / createSetInPointAction()
│   ├── getOutPoint() / createSetOutPointAction()
│   ├── getDuration()
│   └── ...
├── ProjectItem
│   ├── name
│   ├── type
│   ├── getChildren()
│   └── ...
├── SequenceEditor
│   ├── createInsertProjectItemAction()
│   ├── createOverwriteItemAction()
│   ├── createCloneTrackItemAction()
│   ├── createRemoveItemsAction()
│   └── ...
└── TickTime
    ├── seconds
    ├── ticks
    ├── add()
    ├── subtract()
    └── ...
```

### 3.2 Métodos Essenciais para o Projeto

#### 3.2.1 Acessar Projeto e Sequência

```typescript
// Obter projeto ativo
const project: Project = await ppro.Project.getActiveProject();

// Obter todas as sequências
const sequences: Sequence[] = await project.getAllSequences();

// Obter sequência ativa
const activeSequence: Sequence = await project.getActiveSequence();

// Abrir sequência específica
await project.openSequence(sequenceGuid);
```

#### 3.2.2 Acessar Bins (Pastas)

```typescript
// Obter item raiz do projeto (root bin)
const rootItem: ProjectItem = await project.getRootItem();

// Obter filhos de um item (arquivos e subpastas)
const children: ProjectItem[] = await rootItem.getChildren();

// Filtrar por tipo
const bins = children.filter(item => item.type === 'bin');
const media = children.filter(item => item.type === 'clip' || item.type === 'file');

// Acessar nome do item
const name: string = item.name; // ex: "(TAKE 1) A beautiful sunset.mp4"
```

#### 3.2.3 Acessar Tracks

```typescript
// Obter track de vídeo por índice (0-based)
const videoTrack: VideoTrack = await sequence.getVideoTrack(0);

// Obter track de áudio por índice
const audioTrack: AudioTrack = await sequence.getAudioTrack(0);

// Verificar estado do track
const isMuted: boolean = await videoTrack.isMuted();
const trackIndex: number = await videoTrack.getIndex();

// Obter todos os clips do track
const trackItems: VideoClipTrackItem[] = await videoTrack.getTrackItems();
```

#### 3.2.4 Inserir Clips na Timeline

```typescript
// Criar ação de inserção
const insertAction = await ppro.SequenceEditor.createInsertProjectItemAction(
    projectItem,      // item a inserir
    sequence,         // sequência destino
    videoTrackIndex,  // índice do track de vídeo
    audioTrackIndex,  // índice do track de áudio
    insertTime        // TickTime - posição na timeline
);

// Executar ação
await insertAction.execute();

// Alternativa: Overwrite (sobrescreve clips existentes)
const overwriteAction = await ppro.SequenceEditor.createOverwriteItemAction(
    projectItem,
    sequence,
    videoTrackIndex,
    audioTrackIndex,
    insertTime
);
await overwriteAction.execute();
```

#### 3.2.5 Manipular Duração e Pontos de Corte

```typescript
// Obter informações de tempo do clip
const startTime: TickTime = await trackItem.getStartTime();
const endTime: TickTime = await trackItem.getEndTime();
const duration: TickTime = await trackItem.getDuration();
const inPoint: TickTime = await trackItem.getInPoint();
const outPoint: TickTime = await trackItem.getOutPoint();

// Converter para segundos
const durationInSeconds: number = duration.seconds;

// Criar ação para alterar ponto de entrada (para corte)
const setInPointAction = await trackItem.createSetInPointAction(newInPoint);
await setInPointAction.execute();

// Criar ação para alterar ponto de saída (para corte)
const setOutPointAction = await trackItem.createSetOutPointAction(newOutPoint);
await setOutPointAction.execute();

// Criar ação para mover posição inicial na timeline
const setStartAction = await trackItem.createSetStartAction(newStartTime);
await setStartAction.execute();
```

#### 3.2.6 Trabalhar com Tempo (TickTime)

```typescript
// Criar TickTime a partir de segundos
const tickTime = ppro.TickTime.fromSeconds(6.5);

// Operações matemáticas
const sum = tickTime1.add(tickTime2);
const diff = tickTime1.subtract(tickTime2);
const scaled = tickTime.multiply(2);

// Propriedades
const seconds: number = tickTime.seconds;
const ticks: number = tickTime.ticks;
const ticksNumber: bigint = tickTime.ticksNumber;
```

#### 3.2.7 Remover Clips

```typescript
// Criar ação de remoção
const removeAction = await ppro.SequenceEditor.createRemoveItemsAction(
    trackItems,    // array de clips a remover
    ripple         // boolean - se true, ripple delete
);
await removeAction.execute();
```

#### 3.2.8 Clonar Clips

```typescript
// Criar ação de clone
const cloneAction = await ppro.SequenceEditor.createCloneTrackItemAction(
    trackItem,     // clip a clonar
    offsetTime     // TickTime - offset da posição original
);
await cloneAction.execute();
```

### 3.3 Tipos TypeScript Importantes

```typescript
// Tipos de mídia
type ProjectItemType = 'clip' | 'bin' | 'file' | 'root';

// Interface de configuração do organizador
interface OrganizerConfig {
    videoBin: ProjectItem;
    imageBin: ProjectItem;
    pattern: ('V' | 'I')[];
    randomDuration: {
        enabled: boolean;
        min: number; // segundos
        max: number; // segundos
    };
}

// Interface de Take pareado
interface TakeMatch {
    takeNumber: number;
    video: ProjectItem | null;
    image: ProjectItem | null;
}

// Interface de clip organizado
interface OrganizedClip {
    projectItem: ProjectItem;
    type: 'video' | 'image';
    takeNumber: number;
    duration: number; // segundos
    position: number; // segundos na timeline
}
```

---

## 4. Repositórios de Referência

### 4.1 Repositórios Oficiais Adobe

#### AdobeDocs/uxp-premiere-pro-samples
**URL**: https://github.com/AdobeDocs/uxp-premiere-pro-samples

**Descrição**: Samples oficiais da Adobe para desenvolvimento UXP no Premiere Pro.

**Estrutura relevante**:
```
sample-panels/
└── premiere-api/
    └── html/
        ├── index.ts          # Exemplos de uso da API
        ├── types.d.ts        # Definições TypeScript completas
        ├── manifest.json     # Configuração do plugin
        └── package.json      # Dependências
```

**Destaques**:
- `types.d.ts` - Arquivo com todas as definições de tipos da API UXP
- `index.ts` - 64KB de exemplos práticos de uso da API
- Demonstra inserção, remoção, clonagem de clips
- Mostra como acessar bins e project items

**Como usar**:
```bash
cd sample-panels/premiere-api/html
npm install
npm run build
# Carregar build/manifest.json no UDT
```

#### Adobe-CEP/Samples (PProPanel)
**URL**: https://github.com/Adobe-CEP/Samples/tree/master/PProPanel

**Descrição**: Panel de referência completo para CEP/ExtendScript (legado, mas útil para entender a API).

**Arquivo principal**: `jsx/PPRO/Premiere.jsx` (107KB)

**Destaques**:
- Exercita praticamente toda a API ExtendScript do Premiere
- Exemplos de manipulação de timeline, tracks, clips
- Código de referência para entender conceitos

### 4.2 Repositórios da Comunidade

#### safethecode/adobe-premierepro-uxp-sample
**URL**: https://github.com/safethecode/adobe-premierepro-uxp-sample

**Descrição**: Template moderno com React, TypeScript, Tailwind CSS e Biome.

**Stack**:
- React 18
- TypeScript
- Tailwind CSS
- Biome (linter/formatter)

**Útil para**: Estrutura de projeto moderna como referência.

#### deCipherDACU/Script-Aligner
**URL**: https://github.com/deCipherDACU/Script-Aligner

**Descrição**: Plugin UXP real para alinhamento de scripts.

**Útil para**: Ver estrutura de plugin UXP em produção.

#### isaacmorgado/SPLICEV2
**URL**: https://github.com/isaacmorgado/SPLICEV2

**Descrição**: Plugin UXP com automação usando serviços de IA.

**Útil para**: Integração com serviços externos em plugins UXP.

#### rmuraix/premianno
**URL**: https://github.com/rmuraix/premianno

**Descrição**: Plugin UXP para anotação de datasets.

**Útil para**: Manipulação de metadados e project items.

### 4.3 Documentação Oficial

| Recurso | URL |
|---------|-----|
| UXP API Docs | https://developer.adobe.com/premiere-pro/uxp/ |
| UXP API Reference | https://developer.adobe.com/premiere-pro/uxp/ppro_reference/ |
| ExtendScript Docs | https://ppro-scripting.docsforadobe.dev/ |
| CEP Getting Started | https://github.com/Adobe-CEP/Getting-Started-guides |
| UDT Download | Creative Cloud Desktop |

---

## 5. Requisitos do Produto

### 5.1 User Stories

```
US-001: Seleção de Bins
COMO editor de vídeo
QUERO selecionar pastas separadas de vídeos e imagens
PARA que o sistema identifique automaticamente meus Takes

Critérios de Aceite:
- Dropdown lista todos os bins do projeto
- Posso selecionar bin de vídeos
- Posso selecionar bin de imagens
- Sistema valida se bins contêm arquivos
```

```
US-002: Detecção de Takes
COMO editor de vídeo
QUERO que o sistema detecte automaticamente os Takes pela nomenclatura
PARA não precisar parear manualmente vídeos e imagens

Critérios de Aceite:
- Sistema extrai número do padrão "(TAKE N) ..."
- Vídeo Take 1 é pareado com Imagem Take 1
- Arquivos sem padrão são ignorados ou sinalizados
- Lista de Takes detectados é exibida
```

```
US-003: Padrão de Intercalação
COMO editor de vídeo
QUERO definir um padrão customizável de intercalação (ex: 2V,1I)
PARA automatizar a organização da minha timeline

Critérios de Aceite:
- Posso digitar padrão como "V,I", "2V,1I", "VVI"
- Sistema expande padrão para sequência completa
- Preview mostra ordem resultante
- Padrão é aplicado ciclicamente aos Takes
```

```
US-004: Cortes Aleatórios
COMO editor de vídeo
QUERO aplicar cortes aleatórios entre 6 e 8 segundos
PARA criar variação natural em mídias de IA que têm sempre 8s

Critérios de Aceite:
- Toggle para ativar/desativar
- Inputs para duração mínima e máxima
- Aplica-se apenas a vídeos (não imagens)
- Duração é aleatória dentro do range
```

```
US-005: Preview
COMO editor de vídeo
QUERO visualizar a ordem final antes de aplicar
PARA evitar erros na timeline

Critérios de Aceite:
- Lista mostra ordem dos clips
- Exibe: Take N | Tipo | Duração
- Atualiza em tempo real ao mudar configurações
```

```
US-006: Aplicação na Timeline
COMO editor de vídeo
QUERO inserir os clips organizados na timeline ativa
PARA finalizar a automação

Critérios de Aceite:
- Botão "Aplicar" executa inserção
- Clips são inseridos sequencialmente
- Duração é aplicada conforme configuração
- Feedback de sucesso/erro é exibido
```

### 5.2 Requisitos Funcionais

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-001 | Listar todos os bins do projeto | P0 |
| RF-002 | Permitir seleção de bin de vídeos | P0 |
| RF-003 | Permitir seleção de bin de imagens | P0 |
| RF-004 | Extrair número do Take do nome do arquivo | P0 |
| RF-005 | Parear vídeos e imagens pelo número do Take | P0 |
| RF-006 | Aceitar padrão de intercalação em formato string | P0 |
| RF-007 | Expandir padrão para sequência de clips | P0 |
| RF-008 | Gerar duração aleatória dentro de range | P0 |
| RF-009 | Inserir clips na timeline ativa | P0 |
| RF-010 | Exibir preview da ordem dos clips | P1 |
| RF-011 | Validar existência de arquivos nos bins | P1 |
| RF-012 | Exibir erros de forma clara | P1 |

### 5.3 Requisitos Não-Funcionais

| ID | Requisito | Especificação |
|----|-----------|---------------|
| RNF-001 | Plataforma | Adobe Premiere Pro 25.6+ |
| RNF-002 | Tecnologia | UXP (Unified Extensibility Platform) |
| RNF-003 | Linguagem | TypeScript |
| RNF-004 | Framework UI | React |
| RNF-005 | Responsividade | < 100ms de feedback na UI |
| RNF-006 | Compatibilidade OS | Windows 10+ / macOS 10.15+ |

---

## 6. Especificações Técnicas

### 6.1 Parser de Nomenclatura

**Padrão de nomenclatura**: `(TAKE N) Prompt...`

**Regex**: `\(TAKE\s*(\d+)\)`

**Exemplos**:
```
"(TAKE 1) A beautiful sunset over the ocean.mp4" → Take 1
"(TAKE 2) Mountains with snow.mp4" → Take 2
"(TAKE 10) City lights at night.jpg" → Take 10
"(TAKE123) No space.mp4" → Take 123
"Random file.mp4" → null (não match)
```

**Implementação**:
```typescript
function parseTakeName(filename: string): number | null {
    const match = filename.match(/\(TAKE\s*(\d+)\)/i);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return null;
}
```

### 6.2 Parser de Padrão

**Formatos aceitos**:
- `"V,I,V,I"` - separado por vírgula
- `"VIVI"` - sequência direta
- `"2V,1I"` - notação com quantidade
- `"2V1I"` - notação compacta

**Implementação**:
```typescript
function parsePattern(input: string): ('V' | 'I')[] {
    const result: ('V' | 'I')[] = [];

    // Remove espaços e converte para maiúsculo
    const clean = input.toUpperCase().replace(/\s/g, '');

    // Regex para capturar "2V" ou "V"
    const regex = /(\d*)([VI])/g;
    let match;

    while ((match = regex.exec(clean)) !== null) {
        const count = match[1] ? parseInt(match[1], 10) : 1;
        const type = match[2] as 'V' | 'I';

        for (let i = 0; i < count; i++) {
            result.push(type);
        }
    }

    return result;
}

// Exemplos:
// parsePattern("V,I") → ['V', 'I']
// parsePattern("2V,1I") → ['V', 'V', 'I']
// parsePattern("VVI") → ['V', 'V', 'I']
```

### 6.3 Gerador de Duração Aleatória

**Especificação**:
- Input: min (segundos), max (segundos)
- Output: valor aleatório entre min e max
- Precisão: 2 casas decimais

**Implementação**:
```typescript
function generateRandomDuration(min: number, max: number): number {
    const random = Math.random() * (max - min) + min;
    return Math.round(random * 100) / 100; // 2 casas decimais
}

// Exemplo:
// generateRandomDuration(6, 8) → 7.34
```

### 6.4 Algoritmo de Organização

```typescript
interface OrganizerConfig {
    videoBin: ProjectItem;
    imageBin: ProjectItem;
    pattern: ('V' | 'I')[];
    randomDuration: {
        enabled: boolean;
        min: number;
        max: number;
    };
}

async function organizeClips(config: OrganizerConfig): Promise<OrganizedClip[]> {
    // 1. Obter arquivos dos bins
    const videos = await config.videoBin.getChildren();
    const images = await config.imageBin.getChildren();

    // 2. Parsear Takes e criar mapa
    const videoMap = new Map<number, ProjectItem>();
    const imageMap = new Map<number, ProjectItem>();

    for (const video of videos) {
        const takeNum = parseTakeName(video.name);
        if (takeNum !== null) {
            videoMap.set(takeNum, video);
        }
    }

    for (const image of images) {
        const takeNum = parseTakeName(image.name);
        if (takeNum !== null) {
            imageMap.set(takeNum, image);
        }
    }

    // 3. Obter todos os números de Takes únicos, ordenados
    const allTakes = [...new Set([...videoMap.keys(), ...imageMap.keys()])].sort((a, b) => a - b);

    // 4. Aplicar padrão e gerar lista organizada
    const result: OrganizedClip[] = [];
    let position = 0;
    let patternIndex = 0;

    for (const takeNum of allTakes) {
        const type = config.pattern[patternIndex % config.pattern.length];
        patternIndex++;

        const item = type === 'V' ? videoMap.get(takeNum) : imageMap.get(takeNum);

        if (item) {
            const duration = type === 'V' && config.randomDuration.enabled
                ? generateRandomDuration(config.randomDuration.min, config.randomDuration.max)
                : 8; // duração padrão

            result.push({
                projectItem: item,
                type: type === 'V' ? 'video' : 'image',
                takeNumber: takeNum,
                duration,
                position
            });

            position += duration;
        }
    }

    return result;
}
```

---

## 7. Arquitetura

### 7.1 Estrutura de Diretórios

```
Premier Organaizer/
├── PRD.md                 # Este documento
├── CLAUDE.md              # Instruções para IA
├── RESEARCH.md            # Pesquisa consolidada
├── README.md              # Documentação de uso
├── package.json           # Dependências npm
├── manifest.json          # Configuração UXP
├── tsconfig.json          # Configuração TypeScript
├── webpack.config.js      # Build configuration
│
├── src/
│   ├── index.html         # Entry point HTML
│   ├── index.tsx          # Entry point React
│   ├── App.tsx            # Componente principal
│   │
│   ├── types/
│   │   └── premiere.d.ts  # Tipos da API UXP
│   │
│   ├── components/
│   │   ├── BinSelector.tsx      # Seleção de pastas
│   │   ├── PatternEditor.tsx    # Edição do padrão
│   │   ├── DurationConfig.tsx   # Config de duração
│   │   └── Preview.tsx          # Visualização
│   │
│   ├── services/
│   │   ├── premiere.ts          # Wrapper da API
│   │   ├── takeParser.ts        # Parser de nomenclatura
│   │   └── organizer.ts         # Lógica principal
│   │
│   └── utils/
│       ├── time.ts              # Helpers de tempo
│       └── pattern.ts           # Parser de padrão
│
└── build/                 # Output compilado
    ├── index.html
    ├── index.js
    └── manifest.json
```

### 7.2 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Estado Global                         ││
│  │  - videoBin: ProjectItem                                ││
│  │  - imageBin: ProjectItem                                ││
│  │  - pattern: string                                      ││
│  │  - randomDuration: { enabled, min, max }                ││
│  │  - organizedClips: OrganizedClip[]                      ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│    ┌─────────────┬───────────┼───────────┬─────────────┐    │
│    ▼             ▼           ▼           ▼             ▼    │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│ │  Bin    │ │  Bin    │ │ Pattern │ │Duration │ │ Preview ││
│ │Selector │ │Selector │ │ Editor  │ │ Config  │ │         ││
│ │(Vídeos) │ │(Imagens)│ │         │ │         │ │         ││
│ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └─────────┘│
│      │           │           │           │                  │
│      └───────────┴───────────┴───────────┘                  │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Services Layer                        ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     ││
│  │  │ premiere.ts  │ │ takeParser   │ │ organizer.ts │     ││
│  │  │ (API Wrapper)│ │    .ts       │ │   (Logic)    │     ││
│  │  └──────────────┘ └──────────────┘ └──────────────┘     ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Premiere Pro UXP API                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Fluxo de Dados

```
1. CARREGAR BINS
   User seleciona bins → BinSelector → premiere.ts → UXP API
                                                         │
                                        ┌────────────────┘
                                        ▼
   App state ← videoBin/imageBin ← ProjectItem[]

2. CONFIGURAR PADRÃO
   User digita "2V,1I" → PatternEditor → pattern.ts
                                              │
                              ┌───────────────┘
                              ▼
   App state ← pattern ← ['V','V','I']

3. GERAR PREVIEW
   App state → organizer.ts → takeParser.ts
                    │
                    ▼
   Preview ← organizedClips ← OrganizedClip[]

4. APLICAR NA TIMELINE
   User clica "Aplicar" → organizer.ts → premiere.ts → UXP API
                                                           │
                               ┌───────────────────────────┘
                               ▼
   Clips inseridos na timeline do Premiere Pro
```

---

## 8. Plano de Implementação

### 8.1 Etapa 1: Setup do Projeto

**Objetivo**: Configurar ambiente de desenvolvimento UXP

**Tarefas**:
- [ ] Criar estrutura de diretórios
- [ ] Configurar `package.json` com dependências
- [ ] Configurar `manifest.json` para UXP
- [ ] Configurar `tsconfig.json`
- [ ] Configurar `webpack.config.js`
- [ ] Copiar `types.d.ts` do sample oficial

**Dependências principais**:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "webpack": "^5.0.0",
    "webpack-cli": "^5.0.0",
    "ts-loader": "^9.0.0",
    "html-webpack-plugin": "^5.0.0"
  }
}
```

### 8.2 Etapa 2: Serviços Core

**Objetivo**: Implementar lógica de negócio

**Arquivos**:

1. **`src/services/takeParser.ts`**
   - [ ] `parseTakeName(filename: string): number | null`
   - [ ] `matchTakes(videos, images): TakeMatch[]`

2. **`src/utils/pattern.ts`**
   - [ ] `parsePattern(input: string): ('V'|'I')[]`
   - [ ] `expandPattern(pattern, totalTakes): ('V'|'I')[]`
   - [ ] `validatePattern(input: string): boolean`

3. **`src/services/premiere.ts`**
   - [ ] `getProject(): Promise<Project>`
   - [ ] `getAllBins(): Promise<ProjectItem[]>`
   - [ ] `getItemsFromBin(bin): Promise<ProjectItem[]>`
   - [ ] `getActiveSequence(): Promise<Sequence>`
   - [ ] `insertClip(item, position, duration?): Promise<void>`

4. **`src/services/organizer.ts`**
   - [ ] `organizeClips(config): Promise<OrganizedClip[]>`
   - [ ] `applyToTimeline(clips): Promise<void>`
   - [ ] `generateRandomDuration(min, max): number`

### 8.3 Etapa 3: Interface React

**Objetivo**: Criar componentes de UI

**Componentes**:

1. **`src/components/BinSelector.tsx`**
   ```typescript
   interface Props {
       label: string;
       bins: ProjectItem[];
       selectedBin: ProjectItem | null;
       onSelect: (bin: ProjectItem) => void;
   }
   ```

2. **`src/components/PatternEditor.tsx`**
   ```typescript
   interface Props {
       value: string;
       onChange: (pattern: string) => void;
       expandedPattern: ('V'|'I')[];
   }
   ```

3. **`src/components/DurationConfig.tsx`**
   ```typescript
   interface Props {
       enabled: boolean;
       min: number;
       max: number;
       onEnabledChange: (enabled: boolean) => void;
       onMinChange: (min: number) => void;
       onMaxChange: (max: number) => void;
   }
   ```

4. **`src/components/Preview.tsx`**
   ```typescript
   interface Props {
       clips: OrganizedClip[];
   }
   ```

5. **`src/App.tsx`**
   - [ ] Layout principal
   - [ ] Estado global com useState/useReducer
   - [ ] Botões: "Carregar Bins", "Preview", "Aplicar"
   - [ ] Feedback de loading/erro/sucesso

### 8.4 Etapa 4: Integração e Testes

**Objetivo**: Validar funcionamento no Premiere Pro

**Tarefas**:
- [ ] Build do projeto: `npm run build`
- [ ] Carregar no UDT (UXP Developer Tool)
- [ ] Testar com projeto de exemplo
- [ ] Testar edge cases
- [ ] Refinar UX baseado em feedback

---

## 9. Limitações e Workarounds

### 9.1 Mover Clips Entre Tracks

**Limitação**: Não existe API para mover um clip verticalmente entre tracks (ex: V1 → V2).

**Workaround**:
1. Clonar clip com offset 0
2. Inserir clone no novo track
3. Remover clip original

**Nota**: Para nosso caso de uso (inserção nova), isso não é um problema.

### 9.2 Precisão de Frames

**Limitação**: Ao usar `setInPoint()` e `setOutPoint()` com valores em segundos, pode haver erro de 1-2 frames.

**Workaround**:
```typescript
// Adicionar offset de meio frame para correção de arredondamento
const frameRate = 30; // ou obter do projeto
const halfFrame = 0.5 / frameRate;
const correctedTime = targetSeconds + halfFrame;
```

### 9.3 Reordenar Clips na Timeline

**Limitação**: Não existe método direto para reordenar clips existentes.

**Workaround**:
1. Armazenar informações dos clips
2. Remover todos os clips
3. Reinserir na nova ordem

**Nota**: Para nosso caso (inserção nova em timeline limpa ou no final), não precisamos reordenar.

### 9.4 Identificar Tipo de Mídia

**Limitação**: A API não distingue claramente entre vídeo e imagem estática.

**Workaround**: Usar extensão do arquivo:
```typescript
const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff'];

function getMediaType(filename: string): 'video' | 'image' | 'unknown' {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
    if (videoExtensions.includes(ext)) return 'video';
    if (imageExtensions.includes(ext)) return 'image';
    return 'unknown';
}
```

**Nota**: Para nosso caso, usamos bins separados, então o tipo é implícito pela seleção.

---

## 10. Verificação e Testes

### 10.1 Pré-requisitos

- Adobe Premiere Pro 25.6+ instalado
- UXP Developer Tool (UDT) v2.2.1+ instalado via Creative Cloud
- Node.js 18+ instalado

### 10.2 Build do Projeto

```bash
# Navegar ao diretório do projeto
cd "/Users/network/Desktop/Work/Premier Organaizer"

# Instalar dependências
npm install

# Build para desenvolvimento
npm run build

# Build para produção (se configurado)
npm run build:prod
```

### 10.3 Carregar no Premiere Pro

1. Abrir Adobe Premiere Pro 25.6+
2. Abrir UXP Developer Tool (UDT)
3. Clicar "Add Plugin"
4. Navegar até `build/manifest.json`
5. Plugin aparece na lista do UDT
6. Clicar "Load" para carregar no Premiere
7. Acessar via Window > Extensions > Premier Organizer

### 10.4 Cenários de Teste

#### Teste 1: Carregamento de Bins
```
DADO que tenho um projeto com bins "Videos" e "Images"
QUANDO abro o plugin
ENTÃO os bins aparecem nos dropdowns
```

#### Teste 2: Detecção de Takes
```
DADO que o bin "Videos" contém:
  - "(TAKE 1) sunset.mp4"
  - "(TAKE 2) mountains.mp4"
  - "(TAKE 3) city.mp4"
E o bin "Images" contém:
  - "(TAKE 1) sunset.jpg"
  - "(TAKE 2) mountains.jpg"
  - "(TAKE 3) city.jpg"
QUANDO seleciono ambos os bins
ENTÃO sistema detecta 3 Takes pareados
```

#### Teste 3: Padrão de Intercalação
```
DADO que tenho 3 Takes
E defino padrão "V,I"
QUANDO clico Preview
ENTÃO vejo:
  - Take 1 | Video
  - Take 1 | Image
  - Take 2 | Video
  - Take 2 | Image
  - Take 3 | Video
  - Take 3 | Image
```

#### Teste 4: Corte Aleatório
```
DADO que ativo cortes aleatórios (6-8s)
QUANDO clico Preview
ENTÃO cada vídeo mostra duração entre 6.00 e 8.00 segundos
E cada duração é diferente (aleatória)
```

#### Teste 5: Aplicação na Timeline
```
DADO que tenho Preview válido
QUANDO clico Aplicar
ENTÃO clips são inseridos na timeline ativa
E ordem corresponde ao Preview
E durações correspondem às configuradas
```

### 10.5 Edge Cases

| Cenário | Comportamento Esperado |
|---------|------------------------|
| Bin vazio | Exibir mensagem "Nenhum arquivo encontrado" |
| Arquivo sem TAKE | Ignorar arquivo, não incluir na lista |
| Take sem par (só vídeo ou só imagem) | Incluir apenas o que existe |
| Padrão inválido | Exibir erro, não permitir aplicar |
| Duração min > max | Exibir erro, corrigir automaticamente |
| Timeline sem tracks | Criar track automaticamente ou exibir erro |

---

## Apêndices

### A. Configuração manifest.json

```json
{
    "id": "com.premier-organizer.plugin",
    "name": "Premier Organizer",
    "version": "1.0.0",
    "main": "index.html",
    "host": {
        "app": "PProHeadless",
        "minVersion": "25.6.0"
    },
    "entrypoints": [
        {
            "type": "panel",
            "id": "mainPanel",
            "label": {
                "default": "Premier Organizer"
            },
            "minimumSize": {
                "width": 300,
                "height": 400
            },
            "preferredDockedSize": {
                "width": 350,
                "height": 500
            }
        }
    ]
}
```

### B. Links Úteis

- [UXP API Documentation](https://developer.adobe.com/premiere-pro/uxp/)
- [UXP Premiere Samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples)
- [ExtendScript Docs](https://ppro-scripting.docsforadobe.dev/)
- [Adobe Developer Blog - UXP](https://blog.developer.adobe.com/en/publish/2025/12/uxp-arrives-in-premiere-a-new-era-for-plugin-development)

---

**Documento criado em**: Janeiro 2026
**Última atualização**: Janeiro 2026
**Autor**: Premier Organizer Team
