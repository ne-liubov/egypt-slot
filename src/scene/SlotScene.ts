import {
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js";
import { BaseScene } from "../core/BaseScene";
import type { SpinResult } from "../domain/SlotModel";
import {
  getMockSpinResult,
  getRandomGrid,
  getRandomSymbol,
} from "../services/SpinMock";
import type { SlotState } from "../viewmodel/SlotViewModel";
import { SlotViewModel } from "../viewmodel/SlotViewModel";

type ScenePhase = "idle" | "spinning" | "win" | "returning";

const SCENE_CONFIG = {
  machineWidth: 750,
  machineHeight: 643,
  machineOffsetY: -32,
  layoutHeight: 680,
  boardWidth: 600,
  boardHeight: 261,
  boardLeft: 108,
  boardTop: 210,
  reelWidth: 100,
  reelHeight: 87,
  reelGap: 7,
  rowGap: 2,
  reelLeft: 2,
  reelTop: 2,
  symbolSize: 89,
  separatorColor: "#4a5a7f",
} as const;

export class SlotScene extends BaseScene {
  private readonly landscapeBackground = new Sprite();
  private readonly machine = new Container();
  private readonly machineFrame = new Sprite();
  private readonly board = new Container();
  private readonly reelsLayer = new Container();
  private readonly reelsMask = new Graphics();
  private readonly reelContainers: Container[] = [];
  private readonly reelBlurs: BlurFilter[] = [];
  private readonly reelSymbols: Sprite[][] = [];
  private readonly symbolScales = new WeakMap<Sprite, number>();
  private backgroundWidth = 0;
  private backgroundHeight = 0;
  private phase: ScenePhase = "idle";
  private lastIntent = 0;
  private spinElapsed = 0;
  private finishAt = 1500;
  private result: SpinResult | null = null;
  private visibleSymbols = getRandomGrid();
  private reelTapes: string[][] = [];
  private stoppedReels = new Set<number>();
  private reelDistances = [0, 0, 0, 0, 0];
  private reelOffsets = [0, 0, 0, 0, 0];
  private highlightElapsed = 0;
  private winningSymbols: Sprite[] = [];
  private symbolTextures: Record<string, Texture> = {};

  private readonly reelStep = SCENE_CONFIG.reelHeight + SCENE_CONFIG.rowGap;
  private readonly firstSymbolY =
    SCENE_CONFIG.reelTop + SCENE_CONFIG.reelHeight / 2;
  private readonly reelStartTimes = [0, 70, 140, 210, 280];
  private readonly reelStopTimes = [850, 1000, 1150, 1300, 1450];
  private readonly reelDistanceTargets = [9, 12, 15, 18, 21].map(
    (steps) => steps * this.reelStep,
  );
  private readonly liftDuration = 80;
  private readonly settleDuration = 80;
  private readonly winHighlightDuration = 900;

  constructor(private readonly vm: SlotViewModel) {
    super();
  }

  protected create(): void {
    this.app.stage.addChildAt(this.landscapeBackground, 0);
    this.root.addChild(this.machine);
    this.machine.position.set(
      (800 - SCENE_CONFIG.machineWidth) / 2,
      (660 - SCENE_CONFIG.machineHeight) / 2 + SCENE_CONFIG.machineOffsetY,
    );
    this.machine.addChild(this.machineFrame, this.board);
    this.board.position.set(SCENE_CONFIG.boardLeft, SCENE_CONFIG.boardTop);
    void this.loadImages();
    this.createBoard();
    this.draw(this.visibleSymbols);
    this.vm.subscribe((state) => this.onState(state));
    this.app.ticker.add((ticker) => this.update(ticker.deltaMS));
  }

  private createBoard(): void {
    const {
      boardWidth,
      boardHeight,
      reelWidth,
      reelHeight,
      reelGap,
      rowGap,
      reelLeft,
      reelTop,
    } = SCENE_CONFIG;
    this.board.addChild(this.reelsLayer, this.reelsMask);
    this.reelsLayer.mask = this.reelsMask;

    for (let column = 0; column < 5; column++) {
      const reelContainer = new Container();
      const blur = new BlurFilter({ quality: 2 });
      blur.strengthX = 0;
      const reelX = reelLeft + column * (reelWidth + reelGap);
      reelContainer.x = reelX;
      this.reelsMask.rect(
        reelX,
        reelTop,
        reelWidth,
        reelHeight * 3 + rowGap * 2,
      );

      const reel: Sprite[] = [];
      for (let tapeIndex = 0; tapeIndex < 5; tapeIndex++) {
        const symbol = new Sprite();
        symbol.anchor.set(0.5);
        symbol.position.set(
          reelWidth / 2,
          this.firstSymbolY + (tapeIndex - 1) * this.reelStep,
        );
        reelContainer.addChild(symbol);
        reel.push(symbol);
      }
      this.reelsLayer.addChild(reelContainer);
      this.reelContainers.push(reelContainer);
      this.reelBlurs.push(blur);
      this.reelSymbols.push(reel);
    }
    this.reelsMask.fill({ color: 0xffffff });
  }

  private onState(state: SlotState): void {
    if (state.intentId === this.lastIntent) return;
    this.lastIntent = state.intentId;
    if (state.intent === "spin" && this.phase === "idle")
      this.transition("spinning");
    if (state.intent === "stop" && this.phase === "spinning")
      this.finishAt = Math.min(this.finishAt, this.spinElapsed + 180);
  }

  private transition(next: ScenePhase): void {
    this.phase = next;

    if (next === "spinning") {
      if (!this.vm.sceneStartSpin()) {
        this.phase = "idle";
        return;
      }
      this.result = getMockSpinResult(this.vm.snapshot.bet);
      this.spinElapsed = 0;
      this.finishAt = 1500;
      this.stoppedReels.clear();
      this.reelDistances.fill(0);
      this.reelOffsets.fill(0);
      this.reelContainers.forEach((reel) => (reel.filters = []));
      this.resetWinningSymbols();
      this.createReelTapes();
      this.renderAllReels();
    }

    if (next === "win") {
      this.vm.sceneSetPhase("win");
      window.setTimeout(
        () => this.transition("returning"),
        this.winHighlightDuration,
      );
    }
    if (next === "returning") {
      this.resetWinningSymbols();
      this.vm.sceneSetPhase("returning");
      window.setTimeout(() => this.transition("idle"), 250);
    }
    if (next === "idle") {
      this.vm.sceneReturnIdle();
      window.setTimeout(() => this.vm.sceneContinueAuto(), 250);
    }
  }

  private update(deltaMs: number): void {
    this.layoutBackground();
    this.updateHighlights(deltaMs);
    if (this.phase !== "spinning") return;
    this.spinElapsed += deltaMs;
    this.moveReels(deltaMs);

    if (this.stoppedReels.size === 5 && this.result) {
      this.visibleSymbols = this.result.symbols;
      this.showWinningSymbols(this.result);
      this.vm.sceneFinishSpin(this.result);
      this.transition(this.result.win > 0 ? "win" : "returning");
    }
  }

  private async loadImages(): Promise<void> {
    const [background, frame, a, k, q, j, ten, scarab, anubis, pharaoh] =
      await Promise.all([
        Assets.load("/bg.png"),
        Assets.load("/egypt-slot-machine.png"),
        Assets.load("/symbols/a.png"),
        Assets.load("/symbols/k.png"),
        Assets.load("/symbols/q.png"),
        Assets.load("/symbols/j.png"),
        Assets.load("/symbols/10.png"),
        Assets.load("/symbols/scarab.png"),
        Assets.load("/anubis.png"),
        Assets.load("/pharaoh.png"),
      ]);
    this.landscapeBackground.texture = background;
    this.backgroundWidth = 0;
    this.backgroundHeight = 0;
    this.machineFrame.texture = frame;
    this.layoutBackground();
    this.machineFrame.width = SCENE_CONFIG.machineWidth;
    this.machineFrame.height = SCENE_CONFIG.machineHeight;
    this.symbolTextures = {
      a,
      k,
      q,
      j,
      ten,
      scarab,
      anubis,
      pharaoh,
    };
    Object.values(this.symbolTextures).forEach((texture) => {
      texture.source.scaleMode = "linear";
    });
    this.renderAllReels();
  }

  private draw(symbols: string[][]): void {
    this.visibleSymbols = symbols;
    this.renderAllReels();
  }

  private layoutBackground(): void {
    const { width, height } = this.app.screen;
    if (width === this.backgroundWidth && height === this.backgroundHeight)
      return;
    if (this.landscapeBackground.texture.width === 0) return;

    this.backgroundWidth = width;
    this.backgroundHeight = height;
    const overscan = 4;
    const scale = Math.max(
      (width + overscan) / this.landscapeBackground.texture.width,
      (height + overscan) / this.landscapeBackground.texture.height,
    );
    this.landscapeBackground.scale.set(scale);
    this.landscapeBackground.position.set(
      (width - this.landscapeBackground.texture.width * scale) / 2,
      (height - this.landscapeBackground.texture.height * scale) / 2,
    );
  }

  private moveReels(deltaMs: number): void {
    for (let column = 0; column < 5; column++) {
      if (this.stoppedReels.has(column)) continue;

      const spinStart = this.reelStartTimes[column] + this.liftDuration;
      const spinEnd = Math.max(
        spinStart,
        Math.min(this.reelStopTimes[column], this.finishAt),
      );

      if (this.spinElapsed < this.reelStartTimes[column]) continue;
      if (this.spinElapsed < spinStart) {
        this.setReelBlur(column, 0);
        this.reelOffsets[column] =
          (-12 * (this.spinElapsed - this.reelStartTimes[column])) /
          this.liftDuration;
      } else if (this.spinElapsed < spinEnd) {
        this.setReelBlur(column, 7);
        this.reelOffsets[column] = 0;
        const distanceLeft =
          this.reelDistanceTargets[column] - this.reelDistances[column];
        this.reelDistances[column] += Math.min(
          distanceLeft,
          (distanceLeft / (spinEnd - this.spinElapsed)) * deltaMs,
        );
      } else if (this.spinElapsed < spinEnd + this.settleDuration) {
        this.setReelBlur(
          column,
          7 * (1 - (this.spinElapsed - spinEnd) / this.settleDuration),
        );
        this.reelDistances[column] = this.reelDistanceTargets[column];
        this.reelOffsets[column] =
          (8 * (this.spinElapsed - spinEnd)) / this.settleDuration;
      } else if (this.spinElapsed < spinEnd + this.settleDuration * 2) {
        this.setReelBlur(column, 0);
        this.reelDistances[column] = this.reelDistanceTargets[column];
        this.reelOffsets[column] =
          8 *
          (1 -
            (this.spinElapsed - spinEnd - this.settleDuration) /
              this.settleDuration);
      } else {
        this.setReelBlur(column, 0);
        this.reelOffsets[column] = 0;
        this.reelDistances[column] = this.reelDistanceTargets[column];
        this.stoppedReels.add(column);
      }
      this.renderReel(column);
    }
  }

  private setReelBlur(column: number, strength: number): void {
    const reel = this.reelContainers[column];
    reel.filters = strength > 0 ? [this.reelBlurs[column]] : [];
    this.reelBlurs[column].strengthY = strength;
  }

  private createReelTapes(): void {
    if (!this.result) return;

    this.reelTapes = this.reelDistanceTargets.map((distance, column) => {
      const steps = distance / this.reelStep;
      const tape = Array.from({ length: steps + 5 }, getRandomSymbol);
      tape[steps + 1] = this.visibleSymbols[0][column];
      tape[steps + 2] = this.visibleSymbols[1][column];
      tape[steps + 3] = this.visibleSymbols[2][column];
      tape[1] = this.result!.symbols[0][column];
      tape[2] = this.result!.symbols[1][column];
      tape[3] = this.result!.symbols[2][column];
      return tape;
    });
  }

  private renderAllReels(): void {
    for (let column = 0; column < 5; column++) this.renderReel(column);
  }

  private renderReel(column: number): void {
    const offset = this.reelDistances[column] % this.reelStep;
    const step = Math.floor(this.reelDistances[column] / this.reelStep);
    const tape = this.reelTapes[column];

    this.reelSymbols[column].forEach((sprite, tapeIndex) => {
      let symbol: string;
      if (tape) {
        const targetStep = this.reelDistanceTargets[column] / this.reelStep;
        symbol = tape[targetStep - step + tapeIndex];
      } else {
        const row = (tapeIndex - 1 + 3) % 3;
        symbol = this.visibleSymbols[row][column];
      }
      const texture = this.symbolTextures[symbol];
      if (texture && sprite.texture !== texture) {
        sprite.texture = texture;
        const baseScale = Math.min(
          SCENE_CONFIG.symbolSize / texture.width,
          SCENE_CONFIG.symbolSize / texture.height,
        );
        sprite.scale.set(baseScale);
        this.symbolScales.set(sprite, baseScale);
      }
      sprite.y =
        this.firstSymbolY +
        (tapeIndex - 1) * this.reelStep +
        offset +
        this.reelOffsets[column];
    });
  }

  private showWinningSymbols(result: SpinResult): void {
    this.resetWinningSymbols();
    this.highlightElapsed = 0;
    this.winningSymbols = result.winningPositions.map(
      ({ row, column }) => this.reelSymbols[column][row + 1],
    );
  }

  private updateHighlights(deltaMs: number): void {
    if (this.winningSymbols.length === 0) return;
    this.highlightElapsed += deltaMs;
    const progress = Math.min(
      this.highlightElapsed / this.winHighlightDuration,
      1,
    );
    const scale = 1 + Math.sin(progress * Math.PI) ** 2 * 0.03;
    this.winningSymbols.forEach((symbol) => {
      symbol.scale.set((this.symbolScales.get(symbol) ?? 1) * scale);
    });
  }

  private resetWinningSymbols(): void {
    this.winningSymbols.forEach((symbol) => {
      symbol.scale.set(this.symbolScales.get(symbol) ?? 1);
    });
    this.winningSymbols = [];
  }
}
