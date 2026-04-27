# ChessLens — Chess Game Analysis App

A professional chess game analysis web app powered by Stockfish WASM, deployable on Netlify.

## Features

- **Stockfish WASM engine** running in a Web Worker (no UI freezing)
- **Move classification**: Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Miss
- **Accuracy scores** for White and Black (Chess.com-style)
- **Evaluation bar** and **graph** over the full game
- **PGN import** from Chess.com, Lichess, or any source
- **Interactive board** with move navigation
- **Review mode** that guides you through mistakes
- **Opening detection** from ECO codes
- **Brilliant move detection** (sacrifice + near-only move requirement)

## Quick Start

```bash
npm install
npm run dev
```

## Build for Netlify

```bash
npm run build
```

The `dist/` folder is ready to deploy on Netlify.

## Architecture

### Engine (Stockfish WASM)
- Runs in a Web Worker via `src/workers/stockfish.worker.js`
- Loaded from CDN: `stockfish-nnue-16-single.js` (single-threaded WASM)
- UCI protocol communication
- MultiPV analysis (top 3 moves per position)

### Move Classification Logic (`src/utils/moveClassifier.js`)
Centipawn loss thresholds vs engine best:
| Classification | Loss vs Best |
|---|---|
| Brilliant | ≤0cp + sacrifice/tactic + near-only move |
| Great | ≤0cp (defensive resource) |
| Best | ≤0cp |
| Excellent | ≤10cp |
| Good | ≤25cp |
| Inaccuracy | ≤50cp |
| Mistake | ≤100cp |
| Blunder | >100cp |
| Miss | >100cp + missed winning move |

### Netlify Configuration (`netlify.toml`)
Includes required COOP/COEP headers for SharedArrayBuffer support (needed by Stockfish WASM).

## Tech Stack
- **React 18** + **Vite 5**
- **chess.js** — chess logic and PGN parsing
- **react-chessboard** — board UI with piece rendering
- **Stockfish 16 WASM** — analysis engine
- **Recharts** — evaluation graph
- **Netlify Functions** — not needed (fully client-side)

## Deployment on Netlify

1. Connect your GitHub repo to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. The `netlify.toml` handles COOP/COEP headers automatically

Or drag & drop the `dist/` folder to Netlify's manual deploy.

## Performance Notes

- Analysis depth: 16 (fast, accurate for most positions)
- Engine runs in Web Worker — UI never freezes
- MultiPV = 3 (analyzes top 3 alternatives per position)
- Lazy loads engine on first use

## Usage

1. Click **Import PGN** and paste your game
2. Click **⚡ Analyze Game** and wait for analysis
3. Click any move to see classification and engine suggestions
4. Use **Review** tab to navigate through mistakes
5. Use arrow keys ← → to navigate moves
