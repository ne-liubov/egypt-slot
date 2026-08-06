import { SlotModel, type SlotData, type SpinResult } from "../domain/SlotModel";
import { BaseViewModel } from "../core/BaseViewModel";

export type Phase = "idle" | "spinning" | "win" | "returning";
export type Intent = "none" | "spin" | "stop";
export interface SlotState extends SlotData {
  phase: Phase;
  isAuto: boolean;
  autoLeft: number;
  canSpin: boolean;
  canStop: boolean;
  canChangeBet: boolean;
  canStartAuto: boolean;
  intent: Intent;
  intentId: number;
}

export class SlotViewModel extends BaseViewModel<SlotState> {
  readonly bets = [10, 20, 50, 100];
  private readonly model = new SlotModel();
  private state: SlotState = {
    ...this.model.snapshot(),
    phase: "idle",
    isAuto: false,
    autoLeft: 0,
    canSpin: true,
    canStop: false,
    canChangeBet: true,
    canStartAuto: true,
    intent: "none",
    intentId: 0,
  };

  getState(): SlotState {
    const idle = this.state.phase === "idle";
    const hasBalance = this.model.canSpin();
    return {
      ...this.state,
      canSpin: idle && !this.state.isAuto && hasBalance,
      canStop: this.state.phase === "spinning" || this.state.isAuto,
      canChangeBet: idle,
      canStartAuto: idle && !this.state.isAuto && hasBalance,
    };
  }
  get snapshot(): SlotState {
    return this.getState();
  }

  setBet(bet: number): void {
    if (this.state.phase !== "idle") return;
    this.model.setBet(bet);
    this.sync();
  }
  requestSpin(): void {
    if (this.state.phase === "idle" && this.model.canSpin())
      this.intent("spin");
  }
  requestStop(): void {
    if (this.state.phase === "spinning") this.intent("stop");
    this.stopAuto();
  }
  startAuto(count = 5): void {
    if (this.state.phase !== "idle" || !this.model.canSpin()) return;
    this.state = { ...this.state, isAuto: true, autoLeft: count };
    this.intent("spin");
  }
  stopAuto(): void {
    if (this.state.isAuto) {
      this.state = { ...this.state, isAuto: false, autoLeft: 0 };
      this.emit();
    }
  }

  sceneStartSpin(): boolean {
    const ok = this.model.startSpin();
    if (ok)
      this.state = {
        ...this.state,
        ...this.model.snapshot(),
        phase: "spinning",
        intent: "none",
      };
    this.emit();
    return ok;
  }
  sceneFinishSpin(result: SpinResult): void {
    this.model.applyResult(result);
    this.state = {
      ...this.state,
      ...this.model.snapshot(),
      intent: "none",
    };
    this.emit();
  }
  sceneSetPhase(phase: "win" | "returning"): void {
    this.state = { ...this.state, phase, intent: "none" };
    this.emit();
  }
  sceneReturnIdle(): void {
    const autoLeft = this.state.isAuto ? this.state.autoLeft - 1 : 0;
    this.state = {
      ...this.state,
      phase: "idle",
      autoLeft: Math.max(0, autoLeft),
      isAuto: autoLeft > 0,
    };
    this.emit();
  }
  sceneContinueAuto(): void {
    if (this.state.isAuto && this.model.canSpin()) this.intent("spin");
    else this.stopAuto();
  }

  private intent(intent: Intent): void {
    this.state = { ...this.state, intent, intentId: this.state.intentId + 1 };
    this.emit();
  }
  private sync(): void {
    this.state = { ...this.state, ...this.model.snapshot() };
    this.emit();
  }
  private emit(): void {
    this.publish();
  }
}
