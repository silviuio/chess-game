import Phaser from 'phaser';
import './style.css';
import './hud.css';
import { BOARD_SIZE, sameSquare, squareKey, type Square } from './board';
import { knightMoves } from './knight';
import { randomSquares } from './items';

const CELL = 100;
const LIGHT = 0xeee8d5;
const DARK = 0x788b69;
const SELECTED = 0xf2d36b;
const MOVE_HINT = 0x1b211d;
const ITEM_FILL = 0xf28c28;
const ITEM_RIM = 0xb4600f;
const ITEM_COUNT = 5;

// A 6×6 board has no single centre square; c3 is one of the four central ones.
const KNIGHT_START: Square = { row: 3, col: 2 };
// Text-variation selector keeps the glyph from turning into an emoji.
const KNIGHT_GLYPH = '♞︎';

const cellCenter = (index: number) => index * CELL + CELL / 2;

const collectedEl = document.querySelector<HTMLOutputElement>('#collected')!;
const totalEl = document.querySelector<HTMLElement>('#total')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart')!;

function renderCounter(collected: number) {
  collectedEl.textContent = String(collected);
  totalEl.textContent = `/${ITEM_COUNT}`;
}

class BoardScene extends Phaser.Scene {
  private knight!: Phaser.GameObjects.Text;
  private highlights!: Phaser.GameObjects.Graphics;
  private items = new Map<string, Phaser.GameObjects.Arc>();
  private knightSquare: Square = KNIGHT_START;
  private selected = false;
  private targets: Square[] = [];
  private moving = false;
  private collected = 0;

  constructor() {
    super('board');
  }

  create() {
    // Phaser reuses this instance on restart, so every run starts from a clean state here.
    this.items = new Map();
    this.knightSquare = KNIGHT_START;
    this.selected = false;
    this.targets = [];
    this.moving = false;
    this.collected = 0;
    renderCounter(0);

    const board = this.add.graphics();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        board.fillStyle((row + col) % 2 === 0 ? LIGHT : DARK);
        board.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }

    for (const square of randomSquares(ITEM_COUNT, [KNIGHT_START])) {
      const item = this.add
        .circle(cellCenter(square.col), cellCenter(square.row), 20, ITEM_FILL)
        .setStrokeStyle(4, ITEM_RIM);
      this.items.set(squareKey(square), item);
    }

    // Above the items so move hints stay visible, below the knight.
    this.highlights = this.add.graphics();

    this.knight = this.add
      .text(cellCenter(KNIGHT_START.col), cellCenter(KNIGHT_START.row), KNIGHT_GLYPH, {
        fontFamily: '"Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif',
        fontSize: '84px',
        color: '#fbf8ef',
        stroke: '#1b211d',
        strokeThickness: 5,
        padding: { x: 4, y: 4 },
      })
      .setOrigin(0.5);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTap(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const square = this.squareAt(pointer);
      const tappable = square !== null && (sameSquare(square, this.knightSquare) || this.isTarget(square));
      this.input.setDefaultCursor(tappable ? 'pointer' : 'default');
    });
  }

  private squareAt(pointer: Phaser.Input.Pointer): Square | null {
    const row = Math.floor(pointer.y / CELL);
    const col = Math.floor(pointer.x / CELL);
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE ? { row, col } : null;
  }

  private isTarget(square: Square) {
    return this.targets.some((target) => sameSquare(target, square));
  }

  private onTap(pointer: Phaser.Input.Pointer) {
    if (this.moving) return;
    const square = this.squareAt(pointer);
    if (!square) return;

    if (sameSquare(square, this.knightSquare)) {
      if (this.selected) this.deselect();
      else this.select();
    } else if (this.isTarget(square)) {
      this.moveKnightTo(square);
    } else {
      this.deselect();
    }
  }

  private select() {
    this.selected = true;
    this.targets = knightMoves(this.knightSquare);

    this.highlights.clear();
    this.highlights.fillStyle(SELECTED, 0.6);
    this.highlights.fillRect(this.knightSquare.col * CELL, this.knightSquare.row * CELL, CELL, CELL);

    for (const square of this.targets) {
      const x = cellCenter(square.col);
      const y = cellCenter(square.row);
      if (this.items.has(squareKey(square))) {
        // A ring around the item, so the hint doesn't hide it.
        this.highlights.lineStyle(6, MOVE_HINT, 0.3);
        this.highlights.strokeCircle(x, y, 36);
      } else {
        this.highlights.fillStyle(MOVE_HINT, 0.3);
        this.highlights.fillCircle(x, y, 16);
      }
    }
  }

  private deselect() {
    this.selected = false;
    this.targets = [];
    this.highlights.clear();
  }

  private moveKnightTo(square: Square) {
    this.deselect();
    this.knightSquare = square;
    this.moving = true;
    this.tweens.add({
      targets: this.knight,
      x: cellCenter(square.col),
      y: cellCenter(square.row),
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.moving = false;
        this.collectAt(square);
      },
    });
  }

  private collectAt(square: Square) {
    const key = squareKey(square);
    const item = this.items.get(key);
    if (!item) return;

    this.items.delete(key);
    this.collected += 1;
    renderCounter(this.collected);

    this.tweens.add({
      targets: item,
      scale: 1.8,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => item.destroy(),
    });
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'board',
  width: 600,
  height: 600,
  backgroundColor: '#eee8d5',
  scene: BoardScene,
  // CSS owns display sizing; keep the drawing surface at 600 × 600.
  scale: { mode: Phaser.Scale.NONE },
  audio: { noAudio: true },
});

restartButton.addEventListener('click', () => {
  game.scene.getScene('board')?.scene.restart();
});
