# Premier Organizer - Pesquisa Consolidada

> Documento de pesquisa sobre automação do Adobe Premiere Pro

**Data**: Janeiro 2026

---

## 1. Resumo das Tecnologias

### Decisão Final: UXP

| Tecnologia | Status | Recomendação |
|------------|--------|--------------|
| ExtendScript | Legado (até Set 2026) | Não usar |
| CEP | Legado (sendo descontinuado) | Não usar |
| **UXP** | **Atual e oficial** | **USAR** |

---

## 2. UXP - Unified Extensibility Platform

### 2.1 O que é

- Plataforma de extensibilidade atual da Adobe
- Disponível no Premiere Pro desde versão 25.6 (Nov 2025)
- JavaScript moderno (ES6+)
- Execução assíncrona (não bloqueia UI)
- Suporte a React e TypeScript

### 2.2 Documentação Oficial

| Recurso | URL |
|---------|-----|
| Portal Principal | https://developer.adobe.com/premiere-pro/uxp/ |
| API Reference | https://developer.adobe.com/premiere-pro/uxp/ppro_reference/ |
| Samples GitHub | https://github.com/AdobeDocs/uxp-premiere-pro-samples |
| Blog Anúncio | https://blog.developer.adobe.com/en/publish/2025/12/uxp-arrives-in-premiere-a-new-era-for-plugin-development |

### 2.3 Ferramentas Necessárias

1. **Premiere Pro 25.6+** - via Creative Cloud
2. **UXP Developer Tool (UDT) v2.2.1+** - via Creative Cloud
3. **Node.js 18+** - para build
4. **VS Code** - IDE recomendada

### 2.4 Estrutura de Plugin UXP

```
plugin/
├── manifest.json    # Configuração do plugin
├── index.html       # Entry point
├── index.js         # Código JavaScript
└── types.d.ts       # Tipos TypeScript (opcional)
```

### 2.5 manifest.json Exemplo

```json
{
    "id": "com.meu-plugin",
    "name": "Meu Plugin",
    "version": "1.0.0",
    "main": "index.html",
    "host": {
        "app": "PProHeadless",
        "minVersion": "25.6.0"
    },
    "entrypoints": [{
        "type": "panel",
        "id": "mainPanel",
        "label": { "default": "Meu Plugin" }
    }]
}
```

---

## 3. API UXP Premiere Pro

### 3.1 Módulos Principais

```javascript
// Importar módulo principal
const ppro = require('premierepro');

// Objetos principais
ppro.Project        // Projeto
ppro.Sequence       // Sequência/Timeline
ppro.VideoTrack     // Track de vídeo
ppro.AudioTrack     // Track de áudio
ppro.ProjectItem    // Item do projeto (arquivo/bin)
ppro.SequenceEditor // Editor de sequência
ppro.TickTime       // Objeto de tempo
```

### 3.2 Métodos Essenciais

#### Projeto e Sequência

```javascript
// Obter projeto ativo
const project = await ppro.Project.getActiveProject();

// Obter sequência ativa
const sequence = await project.getActiveSequence();

// Obter todas as sequências
const sequences = await project.getAllSequences();

// Obter item raiz (root bin)
const rootItem = await project.getRootItem();
```

#### Bins e Items

```javascript
// Obter filhos de um item (arquivos e subpastas)
const children = await rootItem.getChildren();

// Propriedades do item
const name = item.name;        // "(TAKE 1) sunset.mp4"
const type = item.type;        // "clip", "bin", "file"
```

#### Tracks

```javascript
// Obter track de vídeo (0-indexed)
const videoTrack = await sequence.getVideoTrack(0);

// Obter track de áudio
const audioTrack = await sequence.getAudioTrack(0);

// Obter clips do track
const trackItems = await videoTrack.getTrackItems();
```

#### Inserir Clips

```javascript
// Criar ação de inserção
const insertAction = await ppro.SequenceEditor.createInsertProjectItemAction(
    projectItem,      // item a inserir
    sequence,         // sequência
    videoTrackIndex,  // índice V track
    audioTrackIndex,  // índice A track
    insertTime        // TickTime
);

// Executar
await insertAction.execute();
```

#### Manipular Tempo

```javascript
// Criar TickTime de segundos
const time = ppro.TickTime.fromSeconds(6.5);

// Propriedades
const seconds = time.seconds;
const ticks = time.ticks;

// Operações
const sum = time1.add(time2);
const diff = time1.subtract(time2);
```

#### Pontos de Corte

```javascript
// Obter pontos
const inPoint = await trackItem.getInPoint();
const outPoint = await trackItem.getOutPoint();
const duration = await trackItem.getDuration();

// Alterar ponto de saída (para cortar)
const action = await trackItem.createSetOutPointAction(newOutPoint);
await action.execute();
```

### 3.3 Diferenças UXP vs ExtendScript

| Aspecto | ExtendScript | UXP |
|---------|--------------|-----|
| Execução | Síncrona | Assíncrona |
| Bloqueia UI | Sim | Não |
| Sintaxe | `app.project.activeSequence` | `await project.getActiveSequence()` |
| Bridge | Não precisa | Não precisa |
| JavaScript | ES3 | ES6+ |

---

## 4. Repositórios de Referência

### 4.1 Oficiais Adobe

| Repo | Descrição | Link |
|------|-----------|------|
| uxp-premiere-pro-samples | Samples oficiais UXP | https://github.com/AdobeDocs/uxp-premiere-pro-samples |
| Adobe-CEP/Samples | Samples CEP (legado) | https://github.com/Adobe-CEP/Samples |

### 4.2 Comunidade

| Repo | Descrição | Stack |
|------|-----------|-------|
| safethecode/adobe-premierepro-uxp-sample | Template moderno | React + TS + Tailwind |
| deCipherDACU/Script-Aligner | Plugin de alinhamento | UXP |
| isaacmorgado/SPLICEV2 | Automação com IA | UXP |
| rmuraix/premianno | Anotação de datasets | UXP |

### 4.3 Arquivos Importantes do Sample Oficial

```
uxp-premiere-pro-samples/
└── sample-panels/
    └── premiere-api/
        └── html/
            ├── types.d.ts    # 66KB - TODOS os tipos da API
            ├── index.ts      # 64KB - Exemplos de uso
            └── manifest.json # Config do plugin
```

**IMPORTANTE**: O arquivo `types.d.ts` contém todas as definições TypeScript da API UXP.

---

## 5. Limitações Conhecidas

### 5.1 Mover Clips Entre Tracks

**Problema**: Não existe API para mover clip de V1 para V2.

**Workaround**: Clonar → Inserir no novo track → Remover original.

**Referência**: https://community.adobe.com/t5/premiere-pro-ideas/request-for-timeline-editing-api-support-clip-track-movement-flattening/idc-p/15625115

### 5.2 Precisão de Frames

**Problema**: Erro de 1-2 frames ao usar segundos.

**Workaround**: Usar ticks com offset de meio frame.

```javascript
const frameRate = 30;
const halfFrame = 0.5 / frameRate;
const correctedTime = targetSeconds + halfFrame;
```

### 5.3 Reordenar Clips

**Problema**: Não existe método de reordenação.

**Workaround**: Remover todos → Reinserir na nova ordem.

---

## 6. ExtendScript (Legado - Referência)

### 6.1 Status

- Suportado até **setembro 2026**
- Não receberá mais atualizações
- Use apenas para manutenção de código existente

### 6.2 Documentação

- Principal: https://ppro-scripting.docsforadobe.dev/
- Sample Panel: https://github.com/Adobe-CEP/Samples/tree/master/PProPanel

### 6.3 Exemplo de Código

```javascript
// ExtendScript (legado)
var project = app.project;
var seq = project.activeSequence;
var track = seq.videoTracks[0];

// Inserir clip (síncrono - bloqueia UI)
track.insertClip(projectItem, 0);

// Obter clips
var clips = track.clips;
for (var i = 0; i < clips.numItems; i++) {
    var clip = clips[i];
    $.writeln(clip.name);
}
```

---

## 7. CEP (Legado - Referência)

### 7.1 Status

- Substituído por UXP desde Premiere 25.6
- Suporte planejado por mais ~1 ano
- Não iniciar projetos novos em CEP

### 7.2 Arquitetura

```
CEP Panel
├── HTML/CSS/JS (frontend - Chromium)
├── Node.js (backend)
└── ExtendScript (comunicação com Premiere)
    └── CSInterface.evalScript() - bridge
```

### 7.3 Instalação de Panels

- Windows: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions`
- Mac: `/Library/Application Support/Adobe/CEP/extensions`

---

## 8. Recursos Adicionais

### 8.1 Blogs e Artigos

- [UXP Arrives in Premiere](https://blog.developer.adobe.com/en/publish/2025/12/uxp-arrives-in-premiere-a-new-era-for-plugin-development)
- [Automate Premiere Pro with AI](https://vakago-tools.com/automate-premiere-pro-with-ai-chatgpt-and-extendscript/)
- [Using ExtendScript to Automate](https://metadesignsolutions.com/using-adobe-extendscript-to-automate-video-editing-in-premiere-pro/)

### 8.2 Comunidade

- Adobe Community: https://community.adobe.com/t5/premiere-pro/ct-p/ct-premiere-pro
- Creative COW: https://creativecow.net/forums/forum/adobe-premiere-pro/

### 8.3 Ferramentas

| Ferramenta | Uso |
|------------|-----|
| UXP Developer Tool (UDT) | Carregar/debugar plugins UXP |
| VS Code + ExtendScript Debugger | Debug de ExtendScript (legado) |
| Bolt CEP | Template para CEP (legado) |

---

## 9. Conclusões da Pesquisa

### 9.1 Decisão Tecnológica

**UXP é a escolha correta porque**:
1. É a plataforma oficial e atual da Adobe
2. Suporta JavaScript moderno
3. Não bloqueia a UI do Premiere
4. Tem futuro garantido
5. Permite publicação no Adobe Marketplace

### 9.2 Viabilidade do Projeto

**O projeto é viável porque**:
1. API UXP tem todos os métodos necessários
2. Inserção de clips é bem suportada
3. Manipulação de duração está disponível
4. Acesso a bins/projeto items funciona
5. Existem samples oficiais como referência

### 9.3 Riscos Identificados

| Risco | Mitigação |
|-------|-----------|
| API em evolução | Seguir documentação oficial, testar frequentemente |
| Poucos exemplos UXP | Usar sample oficial como base |
| Premiere Beta required | UXP agora está na versão estável 25.6 |

---

**Pesquisa realizada em**: Janeiro 2026
**Fontes**: Adobe Developer Docs, GitHub, Adobe Community
