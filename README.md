# Coil

Coil is a browser based neon grid serpent. Guide the snake through a walled grid, eat pellets to grow, and collect them quickly to raise the scoring multiplier. The combo bar drains as you travel, so a good route matters as much as survival.

## Run

Use Node.js and npm:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. For a static production site, run `npm run build` and serve `dist/` at the root or at a subpath. The art and audio are committed files; the build bundles them without requiring the asset generation tools.

## Controls

| Action | Keys |
| --- | --- |
| Turn | Arrow keys or W A S D |
| Select menu item | Enter or Space |
| Pause or resume | Escape or P |
| Return from a menu | Escape |
| Mute | M |

Menu items also respond to mouse, pen, and touch. The engine supplies touch controls for the four directions.

## Checks

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` check the implementation. `showcase/` contains screenshots and a recorded combo run.
