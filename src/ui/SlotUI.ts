import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { SlotState } from "../viewmodel/SlotViewModel";
import { SlotViewModel } from "../viewmodel/SlotViewModel";

const phaseName: Record<SlotState["phase"], string> = {
  idle: "Idle",
  spinning: "Spinning",
  win: "Win",
  returning: "Returning",
};

const playIcon = "↻";
const stopIcon = "◻︎";

const UI_CONFIG = {
  width: 800,
  height: 660,
  infoY: 520,
  controlsY: 566,
  buttonWidth: 112,
  buttonHeight: 36,
  spinSize: 64,
  backgroundColor: "#0b1d35",
  buttonColor: "#123451",
  buttonBorder: "#c8962f",
  accentColor: "#d6a02d",
  accentBorder: "#ffe09a",
} as const;

type Button = {
  view: Container;
  background: Graphics;
  label: Text;
};

export class SlotUI extends Container {
  private readonly infoContainer = new Container();
  private readonly controlsContainer = new Container();
  private readonly balance = this.createInfo("Balance", 239, 130);
  private readonly bet = this.createInfo("Bet", 356, 80);
  private readonly win = this.createInfo("Win", 444, 80);
  private readonly phase = this.createInfo("Phase", 561, 130);
  private readonly minusButton = this.createButton(24, UI_CONFIG.buttonHeight);
  private readonly betButton = this.createButton(64, UI_CONFIG.buttonHeight);
  private readonly plusButton = this.createButton(24, UI_CONFIG.buttonHeight);
  private readonly spinButton = this.createSpinButton();
  private readonly autoButton = this.createButton(
    UI_CONFIG.buttonWidth,
    UI_CONFIG.buttonHeight,
  );
  private state: SlotState;

  constructor(private readonly vm: SlotViewModel) {
    super();
    this.state = vm.snapshot;
    this.create();
    vm.subscribe((state) => this.render(state));
  }

  private create(): void {
    this.addChild(this.infoContainer, this.controlsContainer);
    this.infoContainer.position.set(0, UI_CONFIG.infoY);
    this.controlsContainer.position.set(0, UI_CONFIG.controlsY);

    this.minusButton.view.position.set(236, 14);
    this.betButton.view.position.set(264, 14);
    this.betButton.view.eventMode = "none";
    this.plusButton.view.position.set(332, 14);
    this.spinButton.view.position.set(
      UI_CONFIG.width / 2,
      UI_CONFIG.spinSize / 2,
    );
    this.autoButton.view.position.set(444, 14);
    this.controlsContainer.addChild(
      this.minusButton.view,
      this.betButton.view,
      this.plusButton.view,
      this.spinButton.view,
      this.autoButton.view,
    );

    this.minusButton.view.on("pointertap", () => this.changeBet(-1));
    this.plusButton.view.on("pointertap", () => this.changeBet(1));
    this.spinButton.view.on("pointertap", () => this.handleSpin());
    this.autoButton.view.on("pointertap", () => this.vm.startAuto());
    this.render(this.state);
  }

  private createInfo(label: string, x: number, width: number): Text {
    const container = new Container();
    const text = new Text({
      text: `${label}: 0`,
      style: new TextStyle({
        fill: "#ffffff",
        fontFamily: "Arial",
        fontSize: 14,
      }),
    });
    text.anchor.set(0.5);
    text.position.set(0, 18);
    const background = new Graphics()
      .roundRect(-width / 2, 0, width, 36, 6)
      .fill({ color: UI_CONFIG.backgroundColor });
    container.position.set(x, 0);
    container.addChild(background, text);
    this.infoContainer.addChild(container);
    return text;
  }

  private createButton(width: number, height: number): Button {
    const view = new Container();
    const background = new Graphics()
      .roundRect(0, 0, width, height, 6)
      .fill({ color: UI_CONFIG.buttonColor })
      .stroke({ color: UI_CONFIG.buttonBorder, width: 2 });
    const label = new Text({
      text: "",
      style: new TextStyle({
        fill: "#ffffff",
        fontFamily: "Arial",
        fontSize: 16,
      }),
    });
    label.anchor.set(0.5);
    label.position.set(width / 2, height / 2);
    view.eventMode = "static";
    view.cursor = "pointer";
    view.addChild(background, label);
    return { view, background, label };
  }

  private createSpinButton(): Button {
    const view = new Container();
    const background = new Graphics()
      .circle(0, 0, UI_CONFIG.spinSize / 2)
      .fill({ color: UI_CONFIG.accentColor })
      .stroke({ color: UI_CONFIG.accentBorder, width: 2 });
    const label = new Text({
      text: playIcon,
      style: new TextStyle({
        fill: "#10213b",
        fontFamily: "Arial",
        fontSize: 32,
      }),
    });
    label.anchor.set(0.5);
    label.position.set(0, 0);
    view.eventMode = "static";
    view.cursor = "pointer";
    view.addChild(background, label);
    return { view, background, label };
  }

  private changeBet(direction: number): void {
    if (!this.state.canChangeBet) return;
    const index = this.vm.bets.indexOf(this.state.bet);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= this.vm.bets.length) return;
    this.vm.setBet(this.vm.bets[nextIndex]);
  }

  private handleSpin(): void {
    if (this.state.canStop) this.vm.requestStop();
    else if (this.state.canSpin) this.vm.requestSpin();
  }

  private render(state: SlotState): void {
    this.state = state;
    this.balance.text = `Balance: ${state.balance}`;
    this.bet.text = `Bet: ${state.bet}`;
    this.win.text = `Win: ${state.win}`;
    this.phase.text = `Phase: ${phaseName[state.phase]}`;
    this.minusButton.label.text = "−";
    this.betButton.label.text = `Bet ${state.bet}`;
    this.plusButton.label.text = "+";
    this.spinButton.label.text = state.canStop ? stopIcon : playIcon;
    this.autoButton.label.text = state.isAuto
      ? `Auto ×${state.autoLeft}`
      : "Auto ×5";
    const betIndex = this.vm.bets.indexOf(state.bet);
    this.setAvailable(this.minusButton, state.canChangeBet && betIndex > 0);
    this.setAvailable(
      this.plusButton,
      state.canChangeBet && betIndex < this.vm.bets.length - 1,
    );
    this.setAvailable(this.spinButton, state.canSpin || state.canStop);
    this.setAvailable(this.autoButton, state.canStartAuto);
  }

  private setAvailable(button: Button, isAvailable: boolean): void {
    button.view.eventMode = isAvailable ? "static" : "none";
    button.view.alpha = isAvailable ? 1 : 0.5;
  }
}
