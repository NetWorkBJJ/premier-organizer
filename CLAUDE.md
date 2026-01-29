# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Premier Organizer** - Plugin UXP para Adobe Premiere Pro que automatiza a organização de mídias na timeline.

### Core Functionality
- Lê mídias de bins separados (vídeos e imagens)
- Detecta Takes pela nomenclatura `(TAKE N) Prompt...`
- Permite padrão customizável de intercalação (ex: "2V,1I")
- Aplica cortes aleatórios de duração (6-8s)
- Insere automaticamente na timeline

## Technology Stack

| Component | Technology |
|-----------|------------|
| Platform | Adobe UXP (Unified Extensibility Platform) |
| Runtime | Premiere Pro 25.6+ |
| Language | TypeScript |
| UI Framework | React |
| Build Tool | Webpack |

## Key Documentation

- [PRD.md](PRD.md) - Product Requirements Document completo
- [RESEARCH.md](RESEARCH.md) - Pesquisa de tecnologias consolidada

## Project Structure

```
src/
├── index.html              # Entry point HTML
├── index.tsx               # Entry point React
├── App.tsx                 # Main component
├── types/
│   └── premiere.d.ts       # UXP API types
├── components/
│   ├── BinSelector.tsx     # Seleção de bins
│   ├── PatternEditor.tsx   # Editor de padrão
│   ├── DurationConfig.tsx  # Config duração
│   └── Preview.tsx         # Visualização
├── services/
│   ├── premiere.ts         # API wrapper
│   ├── takeParser.ts       # Parser "(TAKE N)"
│   └── organizer.ts        # Lógica principal
└── utils/
    ├── time.ts             # Helpers de tempo
    └── pattern.ts          # Parser de padrão
```

## Commands

```bash
# Install dependencies
npm install

# Development build
npm run build

# Production build
npm run build:prod

# Watch mode
npm run watch
```

## Testing the Plugin

1. Build: `npm run build`
2. Open Premiere Pro 25.6+
3. Open UXP Developer Tool (UDT)
4. Click "Add Plugin" → select `build/manifest.json`
5. Plugin loads in Premiere

## UXP API Patterns

### Async/Await Required
All UXP API calls are asynchronous:
```typescript
// Correct
const project = await ppro.Project.getActiveProject();
const sequence = await project.getActiveSequence();

// Wrong - will not work
const project = ppro.Project.getActiveProject(); // Returns Promise
```

### Action Pattern
Modifications use action pattern:
```typescript
// Create action
const action = await trackItem.createSetOutPointAction(newTime);
// Execute action
await action.execute();
```

### TickTime for Time Values
```typescript
// Create from seconds
const time = ppro.TickTime.fromSeconds(6.5);

// Access properties
const seconds = time.seconds;
const ticks = time.ticks;
```

## Key Business Logic

### Take Parser Regex
```typescript
const TAKE_REGEX = /\(TAKE\s*(\d+)\)/i;
// "(TAKE 1) sunset.mp4" → 1
// "(TAKE 23) city.mp4" → 23
```

### Pattern Parser
```typescript
// Accepts: "V,I", "2V,1I", "VVI"
// Output: ['V', 'I'] or ['V', 'V', 'I']
```

### Random Duration
```typescript
// Range: min to max seconds
// Applies only to videos, not images
```

## Important Notes

1. **UXP Only** - Do not use ExtendScript or CEP, they are legacy
2. **Premiere 25.6+** - Plugin requires this version minimum
3. **Async All The Way** - Never block, always use async/await
4. **Types from Adobe** - Use official `types.d.ts` from samples

## External Resources

- [UXP API Docs](https://developer.adobe.com/premiere-pro/uxp/)
- [UXP Samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples)
- [ExtendScript Docs](https://ppro-scripting.docsforadobe.dev/) (reference only)
