import Phaser from 'phaser';
import './style.css';
import './hud.css';
import { BOARD_SIZE, sameSquare, squareKey, type Square } from './board';
import { knightMoves } from './knight';
import { randomSquares } from './items';
import { Stopwatch, formatTime } from './stopwatch';

const CELL = 100;
const LIGHT = 0xeee8d5;
const DARK = 0x788b69;
const SELECTED = 0xf2d36b;
const MOVE_HINT = 0x1b211d;
const ITEM_FILL = 0xf28c28;
const ITEM_RIM = 0xb4600f;
const ITEM_COUNT = 5;
const ROUND_COUNT = 5;
// Lets the last coin's pop animation finish before an overlay covers the board.
const ROUND_END_DELAY_MS = 320;
// How long the "Round N" banner stays up between rounds. Not counted in any time.
const BANNER_MS = 900;

// Draw order, bottom to top.
const DEPTH = { board: 0, items: 1, highlights: 2, knight: 3 } as const;

// A 6×6 board has no single centre square; c3 is one of the four central ones.
const KNIGHT_START: Square = { row: 3, col: 2 };
// Text-variation selector keeps the glyph from turning into an emoji.
const KNIGHT_GLYPH = '♞︎';
const BOARD_LABEL =
  'Six by six chessboard with a white knight. Each round, five orange coins appear; ' +
  'tap the knight, then a valid square, to move onto them.';

const cellCenter = (index: number) => index * CELL + CELL / 2;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const roundEl = $<HTMLOutputElement>('#round');
const roundTotalEl = $('#round-total');
const restartButton = $<HTMLButtonElement>('#restart');
const hintsButton = $<HTMLButtonElement>('#hints');
const timerEl = $('#timer');
const startOverlay = $('#start');
const startButton = $<HTMLButtonElement>('#start-button');
const banner = $('#banner');
const bannerTitle = $('#banner-title');
const bannerDetail = $('#banner-detail');
const resultDialog = $<HTMLDialogElement>('#result');
const resultTitle = $('#result-title');
const resultRounds = $<HTMLOListElement>('#result-rounds');
const resultTotal = $<HTMLOutputElement>('#result-total');
const resultRestart = $<HTMLButtonElement>('#result-restart');

function renderRound(round: number) {
  roundEl.textContent = String(round);
  roundTotalEl.textContent = `/${ROUND_COUNT}`;
}

// --- Round clock -------------------------------------------------------------

const stopwatch = new Stopwatch();

function renderTimer() {
  timerEl.textContent = formatTime(stopwatch.elapsed());
  timerEl.dataset.state = stopwatch.state;
}

/** Round times are kept in whole hundredths, so the listed rounds add up exactly to the total. */
const toCentis = (ms: number) => Math.floor(ms / 10);
const formatCentis = (centis: number) => formatTime(centis * 10, 2);

// --- Overlays ----------------------------------------------------------------

function showBanner(nextRound: number, lastRound: number, lastCentis: number) {
  bannerTitle.textContent = `Round ${nextRound}`;
  bannerDetail.textContent = `Round ${lastRound} · ${formatCentis(lastCentis)}`;
  banner.hidden = false;
}

function showResult(roundCentis: number[]) {
  const best = Math.min(...roundCentis);
  const rows = roundCentis.map((centis, i) => {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `Round ${i + 1}`;
    row.append(name);
    if (centis === best) {
      row.classList.add('best');
      const tag = document.createElement('span');
      tag.className = 'best-tag';
      tag.textContent = 'Best';
      row.append(tag);
    }
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatCentis(centis);
    row.append(time);
    return row;
  });
  resultTitle.textContent = `All ${ROUND_COUNT} rounds done`;
  resultRounds.replaceChildren(...rows);
  resultTotal.textContent = formatCentis(roundCentis.reduce((sum, centis) => sum + centis, 0));
  resultDialog.showModal();
}

// --- Hints switch ------------------------------------------------------------

// Whether valid moves are drawn when the knight is selected. Remembered per browser;
// storage can be unavailable (private mode, blocked site data), so fall back to "on".
const HINTS_KEY = 'six-by-six:hints';
let showHints = (() => {
  try {
    return localStorage.getItem(HINTS_KEY) !== 'off';
  } catch {
    return true;
  }
})();

function renderHintsToggle() {
  hintsButton.setAttribute('aria-checked', String(showHints));
}
renderHintsToggle();

// --- Game --------------------------------------------------------------------

/**
 * ready    – Start screen: knight only, no coins, clock idle.
 * playing  – a round is live; taps move the knight.
 * between  – last coin of a round taken; banner, then the next round.
 * done     – all rounds finished; results dialog.
 */
type Phase = 'ready' | 'playing' | 'between' | 'done';

class BoardScene extends Phaser.Scene {
  private knight!: Phaser.GameObjects.Text;
  private highlights!: Phaser.GameObjects.Graphics;
  /** Coins left this round, by square. A round ends when this empties. */
  private items = new Map<string, Phaser.GameObjects.Arc>();
  private knightSquare: Square = KNIGHT_START;
  private selected = false;
  private targets: Square[] = [];
  private moving = false;
  private phase: Phase = 'ready';
  private round = 1;
  private roundCentis: number[] = [];

  constructor() {
    super('board');
  }

  create() {
    // Phaser reuses this instance on restart, so every game starts from a clean state here.
    this.items = new Map();
    this.knightSquare = KNIGHT_START;
    this.selected = false;
    this.targets = [];
    this.moving = false;
    this.phase = 'ready';
    this.round = 1;
    this.roundCentis = [];
    renderRound(1);
    stopwatch.reset();
    renderTimer();
    banner.hidden = true;
    startOverlay.hidden = false;

    const board = this.add.graphics().setDepth(DEPTH.board);
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        board.fillStyle((row + col) % 2 === 0 ? LIGHT : DARK);
        board.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }

    this.highlights = this.add.graphics().setDepth(DEPTH.highlights);

    this.knight = this.add
      .text(cellCenter(KNIGHT_START.col), cellCenter(KNIGHT_START.row), KNIGHT_GLYPH, {
        fontFamily: '"Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif',
        fontSize: '84px',
        color: '#fbf8ef',
        stroke: '#1b211d',
        strokeThickness: 5,
        padding: { x: 4, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.knight)
      // Hidden while an overlay covers the board: it sits right under the overlay text.
      .setVisible(false);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTap(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const square = this.squareAt(pointer);
      // With hints off, a pointer cursor over valid squares would give the moves away.
      const tappable =
        this.phase === 'playing' &&
        square !== null &&
        (sameSquare(square, this.knightSquare) || (showHints && this.isTarget(square)));
      this.input.setDefaultCursor(tappable ? 'pointer' : 'default');
    });
  }

  update() {
    // Phaser already redraws every frame; piggyback on that to tick the HUD clock.
    if (stopwatch.state === 'running') renderTimer();
  }

  /** Start button: reveal round 1. */
  startGame() {
    if (this.phase !== 'ready') return;
    startOverlay.hidden = true;
    this.startRound(1);
  }

  /** New coins appear and the round's clock starts at the same moment. */
  private startRound(round: number) {
    this.round = round;
    renderRound(round);
    this.resetKnight();
    this.knight.setVisible(true);
    this.spawnItems();
    this.phase = 'playing';
    stopwatch.reset();
    stopwatch.start();
    renderTimer();
  }

  /** Every round starts from the same square, so rounds differ only by coin layout. */
  private resetKnight() {
    this.deselect();
    this.tweens.killTweensOf(this.knight);
    this.knightSquare = KNIGHT_START;
    this.knight.setPosition(cellCenter(KNIGHT_START.col), cellCenter(KNIGHT_START.row));
  }

  private spawnItems() {
    for (const item of this.items.values()) item.destroy();
    this.items.clear();
    for (const square of randomSquares(ITEM_COUNT, [KNIGHT_START])) {
      const item = this.add
        .circle(cellCenter(square.col), cellCenter(square.row), 20, ITEM_FILL)
        .setStrokeStyle(4, ITEM_RIM)
        .setDepth(DEPTH.items)
        .setScale(0);
      this.tweens.add({ targets: item, scale: 1, duration: 160, ease: 'Back.easeOut' });
      this.items.set(squareKey(square), item);
    }
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
    if (this.phase !== 'playing' || this.moving) return;
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
    // Always computed: they decide which taps are legal, whether or not they're drawn.
    this.targets = knightMoves(this.knightSquare);
    this.drawHighlights();
  }

  /** Draws the selected square, plus the valid moves when hints are on. */
  drawHighlights() {
    // Guard for a toggle tap that lands while the scene is restarting.
    if (!this.highlights?.scene) return;
    this.highlights.clear();
    if (!this.selected) return;

    this.highlights.fillStyle(SELECTED, 0.6);
    this.highlights.fillRect(this.knightSquare.col * CELL, this.knightSquare.row * CELL, CELL, CELL);
    if (!showHints) return;

    for (const square of this.targets) {
      const x = cellCenter(square.col);
      const y = cellCenter(square.row);
      if (this.items.has(squareKey(square))) {
        // A ring around the coin, so the hint doesn't hide it.
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
    // The round ends at the tap that takes the last coin, so its slide isn't counted.
    const tappedAt = performance.now();
    const finishing = this.items.size === 1 && this.items.has(squareKey(square));
    if (finishing) {
      stopwatch.stop(tappedAt);
      renderTimer();
      this.phase = 'between';
    }

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
        // Scene clock: cancelled automatically if the player restarts in the meantime.
        if (finishing) this.time.delayedCall(ROUND_END_DELAY_MS, () => this.endRound());
      },
    });
  }

  private collectAt(square: Square) {
    const key = squareKey(square);
    const item = this.items.get(key);
    if (!item) return;

    this.items.delete(key);
    this.tweens.add({
      targets: item,
      scale: 1.8,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => item.destroy(),
    });
  }

  private endRound() {
    const centis = toCentis(stopwatch.elapsed());
    this.roundCentis.push(centis);

    if (this.round >= ROUND_COUNT) {
      this.phase = 'done';
      showResult(this.roundCentis);
      return;
    }

    const next = this.round + 1;
    showBanner(next, this.round, centis);
    this.resetKnight();
    this.knight.setVisible(false);
    this.time.delayedCall(BANNER_MS, () => {
      banner.hidden = true;
      this.startRound(next);
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

// The board container now holds buttons (Start), so the image role lives on the canvas itself.
function labelCanvas() {
  game.canvas?.setAttribute('role', 'img');
  game.canvas?.setAttribute('aria-label', BOARD_LABEL);
}
labelCanvas();
game.events.once('ready', labelCanvas);

const boardScene = () => game.scene.getScene('board') as BoardScene | null;

/** Back to the Start screen (abandons a game in progress). */
function restartGame() {
  if (resultDialog.open) resultDialog.close();
  boardScene()?.scene.restart();
}

startButton.addEventListener('click', () => boardScene()?.startGame());
restartButton.addEventListener('click', restartGame);
resultRestart.addEventListener('click', restartGame);

hintsButton.addEventListener('click', () => {
  showHints = !showHints;
  renderHintsToggle();
  try {
    localStorage.setItem(HINTS_KEY, showHints ? 'on' : 'off');
  } catch {
    // Storage unavailable: the switch still works, it just won't be remembered.
  }
  // Redraw straight away, so flipping it with the knight selected shows or hides the moves.
  boardScene()?.drawHighlights();
});
