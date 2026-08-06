import { Application, Container } from "pixi.js";

export abstract class BaseScene {
  protected readonly app = new Application();
  protected readonly root = new Container();
  private screenWidth = 0;
  private screenHeight = 0;

  async mount(
    host: HTMLElement,
    overlays: Container[] = [],
  ): Promise<void> {
    await this.app.init({
      background: "#101522",
      resizeTo: host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);
    this.create();
    this.root.addChild(...overlays);
    this.layoutRoot();
    this.app.ticker.add(() => {
      this.layoutRoot();
    });
  }

  private layoutRoot(): void {
    const { width, height } = this.app.screen;
    if (width === this.screenWidth && height === this.screenHeight) return;

    this.screenWidth = width;
    this.screenHeight = height;
    const scale = Math.min(width / 800, height / 660);
    this.root.scale.set(scale);
    this.root.position.set(
      (width - 800 * scale) / 2,
      (height - 660 * scale) / 2,
    );
  }

  protected abstract create(): void;
}
