export const BOARD_SIZE = 6;

export interface Square {
  row: number;
  col: number;
}

export const onBoard = ({ row, col }: Square, size = BOARD_SIZE) =>
  row >= 0 && row < size && col >= 0 && col < size;

export const sameSquare = (a: Square, b: Square) => a.row === b.row && a.col === b.col;

/** Stable string id for a square, for use as a Map key. */
export const squareKey = ({ row, col }: Square) => `${row},${col}`;
