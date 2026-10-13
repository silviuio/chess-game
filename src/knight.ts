import { BOARD_SIZE, onBoard, type Square } from './board';

// Every L-shaped jump: two squares one way, one square the other.
const KNIGHT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-2, -1], [-2, 1],
  [-1, -2], [-1, 2],
  [1, -2], [1, 2],
  [2, -1], [2, 1],
];

/** Squares a knight on `from` can jump to, ignoring other pieces. */
export function knightMoves(from: Square, size = BOARD_SIZE): Square[] {
  return KNIGHT_OFFSETS
    .map(([dRow, dCol]) => ({ row: from.row + dRow, col: from.col + dCol }))
    .filter((square) => onBoard(square, size));
}
