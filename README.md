# Six by Six

A responsive 6×6 chessboard built with Phaser 4, TypeScript and Vite. Move the knight (tap it, then tap a highlighted square) to collect 5 orange items placed on random squares. The counter at the top tracks progress; the button at the top right restarts with a fresh layout. The **Hints** switch at the top left shows or hides the knight's valid moves (moves stay legal either way), and the choice is remembered per browser.

A timer under the counter starts on the first move and stops on the move that takes the last item; a dialog then shows the final time (to the hundredth) with a Restart button.

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
