import { BOARD_SIZE, squareKey, type Square } from './board';

/** `count` distinct random squares, never one of `exclude`. */
export function randomSquares(count: number, exclude: Square[] = [], size = BOARD_SIZE): Square[] {
  const blocked = new Set(exclude.map(squareKey));
  const free: Square[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!blocked.has(squareKey({ row, col }))) free.push({ row, col });
    }
  }

  // Partial Fisher–Yates: only the first `n` slots need shuffling.
  const n = Math.min(count, free.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (free.length - i));
    [free[i], free[j]] = [free[j], free[i]];
  }
  return free.slice(0, n);
}
