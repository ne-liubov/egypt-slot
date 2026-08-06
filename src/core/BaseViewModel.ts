export abstract class BaseViewModel<TState> {
  private readonly listeners = new Set<(state: TState) => void>();

  subscribe(listener: (state: TState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  protected publish(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  abstract getState(): TState;
}
