# Six by Six

A responsive 6×6 knight game built with Phaser 4, TypeScript and Vite.

## How it plays

- Press **Start**. The game is **5 rounds**; each round places 5 orange coins on random squares and puts the knight back on c3.
- Move the knight onto every coin. It stays selected for the whole round, so each move is a single tap on a square it can reach; taps anywhere else are ignored. The coins only appear when a round starts, and that round's clock starts with them, so there's no planning ahead of the clock.
- The round's clock stops on the tap that takes its last coin. A short "Round N" banner (not timed) leads into the next round.
- The header shows the current round (`1/5`) and the current round's time.
- After round 5, a dialog lists each round's time (fastest marked **Best**) and the **total**, which is the final score. Round times are kept in whole hundredths, so the list adds up exactly to the total.
- **Restart** (top right, or in the dialog) returns to the Start screen.
- The **Hints** switch (top left) shows or hides the knight's valid moves. It's off by default; moves stay legal either way, and the choice is remembered per browser.

## Run

```sh
npm ci
npm run dev
```

## Build and deploy

```sh
npm run build
```

For Vercel, use the Vite preset, build command `npm run build`, and output directory `dist`.

The board adapts to the available phone viewport without requiring fullscreen or Home Screen installation.
