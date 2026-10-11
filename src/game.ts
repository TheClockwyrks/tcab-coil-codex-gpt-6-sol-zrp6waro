import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import {
  ACTIONS,
  BEST_LABEL,
  BINDINGS,
  BITE_SECONDS,
  BOARD_X,
  BOARD_Y,
  CELL,
  CLEARED_TEXT,
  COIL_DEBUG_VERSION,
  COMBO_MAX,
  COMBO_WINDOW,
  CUES,
  CUE_PATHS,
  DIRECTIONS,
  GAMEOVER_TEXT,
  GRID_COLS,
  GRID_ROWS,
  HEAD_FRAMES,
  INTERIOR_MAX_COL,
  INTERIOR_MAX_ROW,
  INTERIOR_MIN_COL,
  INTERIOR_MIN_ROW,
  MODE,
  MODE_LABEL,
  OBSTACLE_CELLS,
  OVER_ITEMS,
  PAUSE_ITEMS,
  PELLET_POINTS,
  SCORE_LABEL,
  SCREENS,
  SPRITE_PATHS,
  STAGE_CX,
  STAGE_H,
  STAGE_W,
  START_CELLS,
  START_DIR,
  TAGLINE_TEXT,
  TICK_SECONDS,
  TITLE_ITEMS,
  TITLE_TEXT,
  TURN_QUEUE_MAX,
  type Cell,
  type Direction,
  type Screen,
} from "./constants";

export const BACKGROUND = "#070d1e";
type Rect = { x: number; y: number; w: number; h: number };
export interface CoilState {
  screen: Screen;
  menuIndex: number;
  titleIndex: number;
  score: number;
  best: number;
  combo: number;
  comboWindow: number;
  muted: boolean;
  ticks: number;
  simTime: number;
  dir: Direction;
  turns: Direction[];
  snake: Cell[];
  pellet: Cell | null;
  obstacles: Cell[];
  steering: boolean;
  travel: boolean;
  pelletRespawn: boolean;
  nextPellet: Cell | null;
  accumulator: number;
  bite: number;
  pointerPress: Record<number, number>;
}
export interface CoilDebugApi {
  version: number;
  reset(s: DeepReadonly<CoilState>): CoilState;
  reconcile(s: DeepReadonly<CoilState>): CoilState;
  snapshot(s: DeepReadonly<CoilState>): Omit<
    CoilState,
    "accumulator" | "bite" | "pointerPress"
  > & {
    version: number;
    mode: typeof MODE;
  };
  menuItemRect(s: DeepReadonly<CoilState>, index: number): Rect | null;
  setScreen(s: DeepReadonly<CoilState>, screen: Screen): CoilState;
  setMenuIndex(s: DeepReadonly<CoilState>, index: number): CoilState;
  setScore(s: DeepReadonly<CoilState>, points: number): CoilState;
  setBest(s: DeepReadonly<CoilState>, points: number): CoilState;
  setCombo(s: DeepReadonly<CoilState>, multiplier: number): CoilState;
  setComboWindow(s: DeepReadonly<CoilState>, seconds: number): CoilState;
  setSnake(s: DeepReadonly<CoilState>, cells: readonly Cell[]): CoilState;
  setDirection(s: DeepReadonly<CoilState>, dir: Direction): CoilState;
  clearTurns(s: DeepReadonly<CoilState>): CoilState;
  setSnakeSteering(s: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setSnakeTravel(s: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setPellet(s: DeepReadonly<CoilState>, col: number, row: number): CoilState;
  clearPellet(s: DeepReadonly<CoilState>): CoilState;
  setPelletRespawn(s: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setNextPellet(
    s: DeepReadonly<CoilState>,
    col: number,
    row: number,
  ): CoilState;
  drawPelletCell(s: DeepReadonly<CoilState>): Cell | null;
}
const copy = (s: DeepReadonly<CoilState>): CoilState => ({
  ...s,
  snake: [...s.snake],
  turns: [...s.turns],
  obstacles: [...s.obstacles],
  pointerPress: { ...s.pointerPress },
});
const same = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;
const inside = (c: Cell) =>
  c.col >= INTERIOR_MIN_COL &&
  c.col <= INTERIOR_MAX_COL &&
  c.row >= INTERIOR_MIN_ROW &&
  c.row <= INTERIOR_MAX_ROW;
const gridCell = (c: Cell) =>
  Number.isInteger(c.col) &&
  Number.isInteger(c.row) &&
  c.col >= 0 &&
  c.col < GRID_COLS &&
  c.row >= 0 &&
  c.row < GRID_ROWS;
const occupied = (s: DeepReadonly<CoilState>, c: Cell) =>
  s.snake.some((p) => same(p, c)) || s.obstacles.some((p) => same(p, c));
function validCells(s: DeepReadonly<CoilState>): Cell[] {
  const cells: Cell[] = [];
  for (let row = INTERIOR_MIN_ROW; row <= INTERIOR_MAX_ROW; row++)
    for (let col = INTERIOR_MIN_COL; col <= INTERIOR_MAX_COL; col++) {
      const c = { col, row };
      if (!occupied(s, c) && (!s.pellet || !same(s.pellet, c))) cells.push(c);
    }
  return cells;
}
function drawCell(s: DeepReadonly<CoilState>): Cell | null {
  const cells = validCells(s);
  return cells.length ? cells[Math.floor(Math.random() * cells.length)] : null;
}
function spawn(s: CoilState): CoilState {
  const cells = validCells(s);
  const pellet = cells.length
    ? s.nextPellet && cells.some((c) => same(c, s.nextPellet!))
      ? s.nextPellet
      : cells[Math.floor(Math.random() * cells.length)]
    : null;
  return {
    ...s,
    pellet,
    nextPellet: null,
    screen: pellet ? s.screen : "cleared",
  };
}
const delta: Record<Direction, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};
const perpendicular = (a: Direction, b: Direction) =>
  (a === "left" || a === "right") !== (b === "left" || b === "right");
function opening(muted = false): CoilState {
  return {
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    score: 0,
    best: 0,
    combo: 1,
    comboWindow: 0,
    muted,
    ticks: 0,
    simTime: 0,
    dir: START_DIR as Direction,
    turns: [],
    snake: START_CELLS.map((c) => ({ ...c })),
    pellet: null,
    obstacles: OBSTACLE_CELLS.map((c) => ({ ...c })),
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: null,
    accumulator: 0,
    bite: 0,
    pointerPress: {},
  };
}
function newRound(s: DeepReadonly<CoilState>): CoilState {
  return spawn({
    ...copy(s),
    screen: "playing",
    menuIndex: 0,
    score: 0,
    combo: 1,
    comboWindow: 0,
    dir: START_DIR as Direction,
    turns: [],
    snake: START_CELLS.map((c) => ({ ...c })),
    pellet: null,
    obstacles: OBSTACLE_CELLS.map((c) => ({ ...c })),
    accumulator: 0,
    bite: 0,
    pointerPress: {},
  });
}
function tick(s: CoilState, audio: UpdateApi["audio"]): CoilState {
  let n = { ...s, ticks: s.ticks + 1, turns: [...s.turns] };
  if (n.steering && n.turns.length) {
    const request = n.turns.shift()!;
    if (perpendicular(n.dir, request)) n.dir = request;
  }
  if (n.travel) {
    const h = n.snake[0],
      d = delta[n.dir],
      next = { col: h.col + d.col, row: h.row + d.row };
    const eat = !!n.pellet && same(next, n.pellet);
    const blocking = eat ? n.snake : n.snake.slice(0, -1);
    if (
      !inside(next) ||
      n.obstacles.some((c) => same(c, next)) ||
      blocking.some((c) => same(c, next))
    ) {
      audio.play(CUES.death);
      audio.stop(CUES.music);
      return { ...n, screen: "gameover", menuIndex: 0, accumulator: 0 };
    }
    n.snake = [next, ...(eat ? n.snake : n.snake.slice(0, -1))];
    if (eat) {
      const raised = n.comboWindow > 0;
      const combo = raised ? Math.min(COMBO_MAX, n.combo + 1) : 1;
      n = {
        ...n,
        combo,
        comboWindow: COMBO_WINDOW,
        score: n.score + PELLET_POINTS * combo,
        bite: BITE_SECONDS,
        pellet: null,
      };
      n.best = Math.max(n.best, n.score);
      audio.play(CUES.eat);
      if (combo > s.combo) audio.play(CUES.comboUp);
      if (n.pelletRespawn) n = spawn(n);
      if (n.screen === "cleared") audio.stop(CUES.music);
    }
  }
  n.comboWindow = Math.max(0, n.comboWindow - TICK_SECONDS);
  if (n.comboWindow === 0) n.combo = 1;
  return n;
}
function menuItems(screen: Screen): readonly string[] {
  return screen === "title"
    ? TITLE_ITEMS
    : screen === "paused"
      ? PAUSE_ITEMS
      : screen === "gameover" || screen === "cleared"
        ? OVER_ITEMS
        : screen === "howto"
          ? ["BACK"]
          : [];
}
function menuRect(screen: Screen, index: number): Rect | null {
  const items = menuItems(screen);
  if (!Number.isInteger(index) || index < 0 || index >= items.length)
    return null;
  const y =
    screen === "title"
      ? 480
      : screen === "howto"
        ? 605
        : screen === "paused"
          ? 365
          : 480;
  return { x: STAGE_CX - 164, y: y + index * 55, w: 328, h: 46 };
}
function hit(screen: Screen, x: number, y: number): number {
  for (let i = 0; i < menuItems(screen).length; i++) {
    const r = menuRect(screen, i)!;
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}
function accept(s: CoilState, api: UpdateApi): CoilState {
  if (s.screen === "title") {
    const n = { ...s, titleIndex: s.menuIndex };
    if (s.menuIndex === 0) {
      api.audio.loop(CUES.music);
      return newRound(n);
    }
    return { ...n, screen: "howto", menuIndex: 0 };
  }
  if (s.screen === "howto")
    return { ...s, screen: "title", menuIndex: s.titleIndex };
  if (s.screen === "paused") {
    if (s.menuIndex === 0) return { ...s, screen: "playing", menuIndex: 0 };
    if (s.menuIndex === 1) {
      if (!api.audio.looping(CUES.music)) api.audio.loop(CUES.music);
      return newRound(s);
    }
    api.audio.stop(CUES.music);
    return { ...s, screen: "title", menuIndex: s.titleIndex };
  }
  if (s.screen === "gameover" || s.screen === "cleared") {
    if (s.menuIndex === 0) {
      api.audio.loop(CUES.music);
      return newRound(s);
    }
    return { ...s, screen: "title", menuIndex: s.titleIndex };
  }
  return s;
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Coil debug: ${message}`);
}
function whole(n: number, min = 0, max = Infinity) {
  assert(Number.isInteger(n) && n >= min && n <= max, "number outside domain");
}
function boolean(v: boolean) {
  assert(typeof v === "boolean", "expected boolean");
}
const pose = <K extends keyof CoilState>(
  s: DeepReadonly<CoilState>,
  key: K,
  value: CoilState[K],
): CoilState => ({ ...copy(s), [key]: value });
const debug: CoilDebugApi = {
  version: COIL_DEBUG_VERSION,
  reset: (s) => opening(s.muted),
  reconcile: (s) => copy(s),
  snapshot: (s) => ({
    version: COIL_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    titleIndex: s.titleIndex,
    mode: MODE,
    score: s.score,
    best: s.best,
    combo: s.combo,
    comboWindow: s.comboWindow,
    muted: s.muted,
    ticks: s.ticks,
    simTime: s.simTime,
    dir: s.dir,
    turns: [...s.turns],
    snake: s.snake.map((c) => ({ ...c })),
    pellet: s.pellet && { ...s.pellet },
    obstacles: s.obstacles.map((c) => ({ ...c })),
    steering: s.steering,
    travel: s.travel,
    pelletRespawn: s.pelletRespawn,
    nextPellet: s.nextPellet && { ...s.nextPellet },
  }),
  menuItemRect: (s, index) => {
    whole(index);
    return menuRect(s.screen, index);
  },
  setScreen: (s, screen) => {
    assert((SCREENS as readonly string[]).includes(screen), "invalid screen");
    return pose(s, "screen", screen);
  },
  setMenuIndex: (s, index) => {
    whole(index);
    assert(index < (menuItems(s.screen).length || 1), "invalid menu index");
    return pose(s, "menuIndex", index);
  },
  setScore: (s, points) => {
    whole(points);
    return pose(s, "score", points);
  },
  setBest: (s, points) => {
    whole(points);
    return pose(s, "best", points);
  },
  setCombo: (s, multiplier) => {
    whole(multiplier, 1, COMBO_MAX);
    return pose(s, "combo", multiplier);
  },
  setComboWindow: (s, seconds) => {
    assert(
      Number.isFinite(seconds) && seconds >= 0 && seconds <= COMBO_WINDOW,
      "invalid combo window",
    );
    return pose(s, "comboWindow", seconds);
  },
  setSnake: (s, cells) => {
    assert(Array.isArray(cells) && cells.length >= 1, "invalid snake");
    const seen = new Set<string>();
    cells.forEach((c, i) => {
      assert(
        gridCell(c) && inside(c) && !s.obstacles.some((o) => same(o, c)),
        "invalid snake cell",
      );
      const key = `${c.col},${c.row}`;
      assert(!seen.has(key), "duplicate snake cell");
      seen.add(key);
      if (i)
        assert(
          Math.abs(c.col - cells[i - 1].col) +
            Math.abs(c.row - cells[i - 1].row) ===
            1,
          "disconnected snake",
        );
    });
    return pose(
      s,
      "snake",
      cells.map((c) => ({ ...c })),
    );
  },
  setDirection: (s, dir) => {
    assert(
      (DIRECTIONS as readonly string[]).includes(dir),
      "invalid direction",
    );
    return pose(s, "dir", dir);
  },
  clearTurns: (s) => pose(s, "turns", []),
  setSnakeSteering: (s, enabled) => {
    boolean(enabled);
    return {
      ...copy(s),
      steering: enabled,
      turns: enabled ? [...s.turns] : [],
    };
  },
  setSnakeTravel: (s, enabled) => {
    boolean(enabled);
    return pose(s, "travel", enabled);
  },
  setPellet: (s, col, row) => {
    const c = { col, row };
    assert(gridCell(c) && inside(c) && !occupied(s, c), "invalid pellet");
    return pose(s, "pellet", c);
  },
  clearPellet: (s) => pose(s, "pellet", null),
  setPelletRespawn: (s, enabled) => {
    boolean(enabled);
    return pose(s, "pelletRespawn", enabled);
  },
  setNextPellet: (s, col, row) => {
    const c = { col, row };
    assert(gridCell(c), "invalid next pellet");
    return pose(s, "nextPellet", c);
  },
  drawPelletCell: (s) => drawCell(s),
};

type Sprites = {
  head: ImageBitmap[];
  body: ImageBitmap;
  corner: ImageBitmap;
  tail: ImageBitmap;
};
let sprites: Sprites | null = null;
export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(api: InitApi<CoilState>) {
    for (const action of ACTIONS)
      api.input.register(action, { keys: [...BINDINGS[action]] });
    await Promise.all(
      Object.values(CUES).map((c) => api.audio.load(c, CUE_PATHS[c])),
    );
    const [head, body, corner, tail] = await Promise.all([
      Promise.all(SPRITE_PATHS.head.map((p) => api.assets.loadImage(p))),
      api.assets.loadImage(SPRITE_PATHS.body),
      api.assets.loadImage(SPRITE_PATHS.corner),
      api.assets.loadImage(SPRITE_PATHS.tail),
    ]);
    sprites = { head, body, corner, tail };
    const read: {
      [key: string]: (s: DeepReadonly<CoilState>) => string | number | boolean;
    } = {
      screen: (s) => s.screen,
      score: (s) => s.score,
      best: (s) => s.best,
      combo: (s) => s.combo,
      window: (s) => s.comboWindow.toFixed(2),
      direction: (s) => s.dir,
      length: (s) => s.snake.length,
      head: (s) => `${s.snake[0].col},${s.snake[0].row}`,
      pellet: (s) => (s.pellet ? `${s.pellet.col},${s.pellet.row}` : "none"),
    };
    for (const [name, source] of Object.entries(read))
      api.diagnostics.register(name, source);
    return [opening(), debug];
  },
  update(state, api, dt) {
    let s = copy(state);
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    s.best = Math.max(s.best, s.score);
    const pressed = Object.fromEntries(
      ACTIONS.map((a) => [a, api.input.pressed(a)]),
    ) as Record<(typeof ACTIONS)[number], boolean>;
    if (s.screen === "playing") {
      if (pressed.back || pressed.pause)
        return { ...s, screen: "paused", menuIndex: 0 };
      for (const d of DIRECTIONS)
        if (pressed[d] && s.steering && s.turns.length < TURN_QUEUE_MAX)
          s.turns.push(d);
      s.simTime += dt;
      s.accumulator += dt;
      s.bite = Math.max(0, s.bite - dt);
      while (s.screen === "playing" && s.accumulator + 1e-10 >= TICK_SECONDS) {
        s.accumulator -= TICK_SECONDS;
        s = tick(s, api.audio);
      }
      return s;
    }
    const items = menuItems(s.screen);
    if (pressed.up)
      s.menuIndex = (s.menuIndex + items.length - 1) % items.length;
    if (pressed.down) s.menuIndex = (s.menuIndex + 1) % items.length;
    if (pressed.confirm) s = accept(s, api);
    if (pressed.back || (s.screen === "paused" && pressed.pause)) {
      if (s.screen === "paused") s = { ...s, screen: "playing", menuIndex: 0 };
      else if (
        s.screen === "howto" ||
        s.screen === "gameover" ||
        s.screen === "cleared"
      )
        s = { ...s, screen: "title", menuIndex: s.titleIndex };
    }
    // Ordered samples preserve both edges even when a click begins and ends in one frame.
    for (const sample of api.input.pointerSamples()) {
      if (s.screen === "playing") break;
      const index = hit(s.screen, sample.x, sample.y);
      if (index >= 0) s.menuIndex = index;
      if (sample.type === "down" && sample.button === "primary")
        s.pointerPress[sample.id] = index;
      if (sample.type === "up") {
        if (index >= 0 && s.pointerPress[sample.id] === index) {
          s.menuIndex = index;
          s = accept(s, api);
        }
        delete s.pointerPress[sample.id];
      }
    }
    return s;
  },
  render(state, api) {
    renderGame(state, api);
  },
};
const COLORS = {
  cyan: "#81ffe4",
  mint: "#26cdb9",
  pink: "#ff668e",
  gold: "#ffd474",
  ink: "#09132a",
  dim: "#7891a8",
  line: "#18344c",
  white: "#e8fff9",
};
function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  weight = 600,
) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `${weight} ${size}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText(text, x, y);
}
function drawBoard(ctx: CanvasRenderingContext2D, s: DeepReadonly<CoilState>) {
  const w = GRID_COLS * CELL,
    h = GRID_ROWS * CELL;
  ctx.fillStyle = "#0b1830";
  ctx.fillRect(BOARD_X, BOARD_Y, w, h);
  ctx.fillStyle = "#0d2236";
  ctx.fillRect(BOARD_X + CELL, BOARD_Y + CELL, w - 2 * CELL, h - 2 * CELL);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  for (let col = 1; col < GRID_COLS; col++) {
    const x = BOARD_X + col * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, BOARD_Y + CELL);
    ctx.lineTo(x, BOARD_Y + h - CELL);
    ctx.stroke();
  }
  for (let row = 1; row < GRID_ROWS; row++) {
    const y = BOARD_Y + row * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(BOARD_X + CELL, y);
    ctx.lineTo(BOARD_X + w - CELL, y);
    ctx.stroke();
  }
  for (let row = 0; row < GRID_ROWS; row++)
    for (let col = 0; col < GRID_COLS; col++)
      if (
        row === 0 ||
        row === GRID_ROWS - 1 ||
        col === 0 ||
        col === GRID_COLS - 1
      ) {
        const x = BOARD_X + col * CELL,
          y = BOARD_Y + row * CELL;
        ctx.fillStyle = (row + col) % 2 ? "#13364d" : "#153f54";
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "#2a6372";
        ctx.fillRect(x + 3, y + 3, CELL - 6, 2);
        ctx.fillStyle = "#103044";
        ctx.fillRect(x + 3, y + CELL - 5, CELL - 6, 2);
        ctx.fillStyle = "#4a8390";
        ctx.fillRect(x + 14, y + 14, 4, 4);
      }
  ctx.strokeStyle = COLORS.mint;
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD_X + CELL, BOARD_Y + CELL, w - 2 * CELL, h - 2 * CELL);
  ctx.strokeStyle = "#32687a";
  ctx.strokeRect(BOARD_X, BOARD_Y, w, h);
  for (const c of s.obstacles) {
    const x = BOARD_X + c.col * CELL,
      y = BOARD_Y + c.row * CELL;
    ctx.fillStyle = COLORS.pink;
    ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x + 8, y + 8, CELL - 16, CELL - 16);
  }
  if (s.pellet) {
    const x = BOARD_X + s.pellet.col * CELL,
      y = BOARD_Y + s.pellet.row * CELL;
    ctx.fillStyle = "#703954";
    ctx.fillRect(x + 3, y + 3, 26, 26);
    ctx.fillStyle = COLORS.pink;
    ctx.fillRect(x + 7, y + 7, 18, 18);
    ctx.fillStyle = "#ffd0d7";
    ctx.fillRect(x + 11, y + 9, 8, 7);
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(x + 14, y + 12, 4, 4);
    ctx.strokeStyle = "#ff9eae";
    ctx.strokeRect(x + 5, y + 5, 22, 22);
  }
  if (sprites) {
    ctx.imageSmoothingEnabled = false;
    for (let i = s.snake.length - 1; i >= 0; i--) {
      const c = s.snake[i],
        p = s.snake[i - 1],
        q = s.snake[i + 1];
      let image: ImageBitmap, angle: number;
      if (i === 0) {
        const frame =
          s.bite > 0
            ? Math.min(
                HEAD_FRAMES - 1,
                1 + Math.floor((1 - s.bite / BITE_SECONDS) * 3),
              )
            : 0;
        image = sprites.head[frame];
        angle = directionAngle(s.dir);
      } else if (i === s.snake.length - 1) {
        image = sprites.tail;
        angle = directionAngle(dirBetween(c, p));
      } else {
        const a = dirBetween(c, p),
          b = dirBetween(c, q);
        if (
          (a === "left" && b === "right") ||
          (a === "right" && b === "left")
        ) {
          image = sprites.body;
          angle = 0;
        } else if (
          (a === "up" && b === "down") ||
          (a === "down" && b === "up")
        ) {
          image = sprites.body;
          angle = Math.PI / 2;
        } else {
          image = sprites.corner;
          angle = cornerAngle(a, b);
        }
      }
      ctx.save();
      ctx.translate(
        BOARD_X + c.col * CELL + CELL / 2,
        BOARD_Y + c.row * CELL + CELL / 2,
      );
      ctx.rotate(angle);
      ctx.drawImage(image, -CELL / 2, -CELL / 2, CELL, CELL);
      ctx.restore();
    }
  }
}
function dirBetween(a: Cell, b: Cell): Direction {
  if (b.col > a.col) return "right";
  if (b.col < a.col) return "left";
  if (b.row > a.row) return "down";
  return "up";
}
function directionAngle(d: Direction) {
  return d === "right"
    ? 0
    : d === "down"
      ? Math.PI / 2
      : d === "left"
        ? Math.PI
        : -Math.PI / 2;
}
function cornerAngle(a: Direction, b: Direction) {
  const ds = [a, b];
  if (ds.includes("right") && ds.includes("down")) return 0;
  if (ds.includes("down") && ds.includes("left")) return Math.PI / 2;
  if (ds.includes("left") && ds.includes("up")) return Math.PI;
  return -Math.PI / 2;
}
function hud(ctx: CanvasRenderingContext2D, s: DeepReadonly<CoilState>) {
  ctx.fillStyle = "#0d1b32";
  ctx.fillRect(BOARD_X, 12, GRID_COLS * CELL, 94);
  ctx.fillStyle = COLORS.mint;
  ctx.fillRect(BOARD_X, 12, GRID_COLS * CELL, 3);
  label(ctx, SCORE_LABEL, BOARD_X + 24, 40, 15, COLORS.dim);
  label(
    ctx,
    String(s.score).padStart(4, "0"),
    BOARD_X + 24,
    83,
    38,
    COLORS.white,
  );
  label(ctx, BEST_LABEL, BOARD_X + 230, 40, 15, COLORS.dim);
  label(
    ctx,
    String(s.best).padStart(4, "0"),
    BOARD_X + 230,
    83,
    38,
    COLORS.white,
  );
  if (s.combo >= 2) {
    label(ctx, `x${s.combo}`, BOARD_X + 497, 75, 39, COLORS.gold);
    ctx.fillStyle = "#274653";
    ctx.fillRect(BOARD_X + 590, 69, 120, 9);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(BOARD_X + 590, 69, (120 * s.comboWindow) / COMBO_WINDOW, 9);
  }
  label(ctx, MODE_LABEL, BOARD_X + 774, 49, 20, COLORS.cyan, "center");
  label(
    ctx,
    s.muted ? "SOUND OFF" : "SOUND ON",
    BOARD_X + 774,
    79,
    13,
    s.muted ? COLORS.pink : COLORS.dim,
    "center",
  );
}
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "rgba(6,15,34,.94)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#37b6b6";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = COLORS.mint;
  ctx.fillRect(x, y, 72, 4);
  ctx.fillRect(x + w - 72, y + h - 4, 72, 4);
}
function menu(ctx: CanvasRenderingContext2D, s: DeepReadonly<CoilState>) {
  menuItems(s.screen).forEach((item, i) => {
    const r = menuRect(s.screen, i)!;
    const selected = s.menuIndex === i;
    ctx.fillStyle = selected ? "#216c73" : "#122c42";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = selected ? COLORS.cyan : "#36536b";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (selected) {
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(r.x + 10, r.y + 10, 5, r.h - 20);
    }
    label(
      ctx,
      item,
      r.x + r.w / 2,
      r.y + 31,
      22,
      selected ? COLORS.white : COLORS.dim,
      "center",
      700,
    );
  });
}
function renderGame(s: DeepReadonly<CoilState>, api: RenderApi) {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0c1830";
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  for (let x = 0; x < STAGE_W; x += 64) {
    ctx.fillStyle = "#0d2940";
    ctx.fillRect(x, 0, 1, STAGE_H);
  }
  for (let y = 0; y < STAGE_H; y += 64) {
    ctx.fillStyle = "#0d2940";
    ctx.fillRect(0, y, STAGE_W, 1);
  }
  drawBoard(ctx, s);
  hud(ctx, s);
  if (s.screen === "playing") return;
  ctx.fillStyle = "rgba(4,11,25,.54)";
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  if (s.screen === "title") {
    panel(ctx, 352, 138, 576, 490);
    label(
      ctx,
      "◈  A SIGNAL IN THE GRID  ◈",
      STAGE_CX,
      196,
      17,
      COLORS.dim,
      "center",
    );
    ctx.shadowColor = COLORS.mint;
    ctx.shadowBlur = 22;
    label(ctx, TITLE_TEXT, STAGE_CX, 311, 100, COLORS.cyan, "center", 900);
    ctx.shadowBlur = 0;
    label(ctx, TAGLINE_TEXT, STAGE_CX, 348, 21, COLORS.pink, "center", 700);
    label(ctx, BEST_LABEL, STAGE_CX, 404, 16, COLORS.dim, "center");
    label(
      ctx,
      String(s.best).padStart(4, "0"),
      STAGE_CX,
      448,
      38,
      COLORS.white,
      "center",
    );
    menu(ctx, s);
    label(
      ctx,
      "ARROWS / WASD   •   ENTER TO SELECT   •   M TO MUTE",
      STAGE_CX,
      612,
      13,
      COLORS.dim,
      "center",
    );
  } else if (s.screen === "howto") {
    panel(ctx, 292, 136, 696, 548);
    label(ctx, "HOW TO PLAY", STAGE_CX, 194, 42, COLORS.cyan, "center", 800);
    const lines = [
      "THE COIL NEVER STOPS. TURN ON THE NEXT TICK.",
      "STEER WITH ARROWS OR W A S D.",
      "TURN PERPENDICULAR. YOU CANNOT DOUBLE BACK.",
      "EAT PINK PELLETS TO GROW ONE CELL.",
      "THE WALLS AND YOUR OWN BODY END THE RUN.",
      "EAT QUICKLY TO RAISE THE COMBO MULTIPLIER.",
      "WHEN THE BAR RUNS OUT, THE COMBO RETURNS TO x1.",
      "ENTER / SPACE SELECT  •  ESC PAUSE / BACK",
      "P PAUSES  •  M TOGGLES SOUND",
    ];
    lines.forEach((line, i) =>
      label(
        ctx,
        line,
        STAGE_CX,
        249 + i * 35,
        17,
        i === 5 ? COLORS.gold : COLORS.white,
        "center",
      ),
    );
    menu(ctx, s);
  } else {
    panel(ctx, 390, 185, 500, 446);
    const title =
      s.screen === "paused"
        ? "PAUSED"
        : s.screen === "cleared"
          ? CLEARED_TEXT
          : GAMEOVER_TEXT;
    label(
      ctx,
      title,
      STAGE_CX,
      258,
      s.screen === "cleared" ? 36 : 46,
      s.screen === "gameover" ? COLORS.pink : COLORS.cyan,
      "center",
      900,
    );
    if (s.screen === "paused") {
      label(
        ctx,
        "THE GRID HOLDS ITS BREATH",
        STAGE_CX,
        309,
        17,
        COLORS.dim,
        "center",
      );
    } else {
      label(ctx, SCORE_LABEL, STAGE_CX - 105, 329, 16, COLORS.dim, "center");
      label(ctx, BEST_LABEL, STAGE_CX + 105, 329, 16, COLORS.dim, "center");
      label(
        ctx,
        String(s.score),
        STAGE_CX - 105,
        373,
        37,
        COLORS.white,
        "center",
      );
      label(
        ctx,
        String(s.best),
        STAGE_CX + 105,
        373,
        37,
        COLORS.gold,
        "center",
      );
    }
    menu(ctx, s);
  }
}
