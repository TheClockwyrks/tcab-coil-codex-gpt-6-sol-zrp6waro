import { describe, expect, it, vi } from "vitest";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import { game, type CoilState } from "./game";
import { COMBO_WINDOW, START_CELLS, TICK_SECONDS } from "./constants";

async function setup() {
  const playing = new Set<string>();
  const events: string[] = [];
  const init = {
    input: { register: vi.fn() },
    audio: { load: vi.fn(async () => {}) },
    assets: { loadImage: vi.fn(async () => ({})) },
    diagnostics: { register: vi.fn() },
  } as unknown as InitApi<CoilState>;
  const [initial, debug] = await game.initialize(init);
  const pressed = new Set<string>();
  const audio = {
    play: (cue: string) => events.push(cue),
    loop: (cue: string) => playing.add(cue),
    stop: (cue: string) => playing.delete(cue),
    looping: (cue: string) => playing.has(cue),
    setMuted: vi.fn(),
    muted: () => false,
  };
  const api = {
    input: {
      pressed: (key: string) => {
        const value = pressed.has(key);
        pressed.delete(key);
        return value;
      },
      pointerSamples: () => [],
    },
    audio,
  } as unknown as UpdateApi;
  const step = (s: CoilState, dt = TICK_SECONDS) => game.update(s, api, dt);
  return { initial, debug, pressed, events, step };
}
describe("Coil simulation", () => {
  it("opens at title and lays one pellet on a new round", async () => {
    const { initial, debug, pressed, step } = await setup();
    expect(debug.snapshot(initial).screen).toBe("title");
    pressed.add("confirm");
    const s = step(initial, 0);
    expect(s.screen).toBe("playing");
    expect(s.pellet).not.toBeNull();
    expect(s.snake).toEqual(START_CELLS);
  });
  it("uses elapsed time, a two-turn buffer, and a fixed tick", async () => {
    const { initial, debug, step, pressed } = await setup();
    let s = debug.setScreen(initial, "playing");
    s = debug.clearPellet(s);
    pressed.add("down");
    s = step(s, TICK_SECONDS / 2);
    expect(s.snake[0]).toEqual(START_CELLS[0]);
    pressed.add("left");
    s = step(s, TICK_SECONDS / 2);
    expect(s.snake[0]).toEqual({ col: 15, row: 9 });
    expect(s.dir).toBe("down");
    s = step(s);
    expect(s.snake[0]).toEqual({ col: 14, row: 9 });
    expect(s.dir).toBe("left");
  });
  it("grows, scores, raises a combo, and drains its window", async () => {
    const { initial, debug, step, events } = await setup();
    let s = debug.setScreen(initial, "playing");
    s = debug.setPellet(s, 16, 8);
    s = debug.setPelletRespawn(s, false);
    s = step(s);
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(10);
    expect(s.comboWindow).toBe(COMBO_WINDOW - TICK_SECONDS);
    expect(events).toContain("eat");
    s = debug.setPellet(s, 17, 8);
    s = step(s);
    expect(s.combo).toBe(2);
    expect(s.score).toBe(30);
    expect(events).toContain("combo-up");
    s = debug.setSnakeTravel(s, false);
    s = step(s, COMBO_WINDOW);
    expect(s.combo).toBe(1);
    expect(s.comboWindow).toBe(0);
  });
  it("resolves fatal collision before moving and banks no elapsed time", async () => {
    const { initial, debug, step, events } = await setup();
    let s = debug.setScreen(initial, "playing");
    s = debug.clearPellet(s);
    s = debug.setSnake(s, [
      { col: 28, row: 8 },
      { col: 27, row: 8 },
    ]);
    s = step(s, 1);
    expect(s.screen).toBe("gameover");
    expect(s.snake[0]).toEqual({ col: 28, row: 8 });
    expect(s.accumulator).toBe(0);
    expect(events).toContain("death");
  });
  it("freezes during pause and validates debug poses", async () => {
    const { initial, debug, step, pressed } = await setup();
    let s = debug.setScreen(initial, "playing");
    pressed.add("pause");
    s = step(s, 0);
    expect(s.screen).toBe("paused");
    const paused = step(s, 2);
    expect(paused.ticks).toBe(s.ticks);
    expect(paused.simTime).toBe(s.simTime);
    expect(() => debug.setScore(s, -1)).toThrow();
    expect(() => debug.setSnake(s, [{ col: 0, row: 0 }])).toThrow();
    expect(debug.menuItemRect(s, 0)).not.toBeNull();
    expect(debug.menuItemRect(s, 12)).toBeNull();
  });
  it("allows chasing the vacating tail and consumes a posed spawn", async () => {
    const { initial, debug, step } = await setup();
    let s = debug.setScreen(initial, "playing");
    s = debug.setSnake(s, [
      { col: 10, row: 10 },
      { col: 10, row: 11 },
      { col: 11, row: 11 },
      { col: 11, row: 10 },
    ]);
    s = debug.clearPellet(s);
    s = step(s);
    expect(s.screen).toBe("playing");
    expect(s.snake[0]).toEqual({ col: 11, row: 10 });
    s = debug.setPellet(s, 12, 10);
    s = debug.setNextPellet(s, 7, 7);
    s = step(s);
    expect(s.pellet).toEqual({ col: 7, row: 7 });
    expect(s.nextPellet).toBeNull();
  });
});
