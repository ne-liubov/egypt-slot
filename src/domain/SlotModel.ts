export interface SpinResult {
  symbols: string[][];
  win: number;
  winningPositions: Array<{ row: number; column: number }>;
}

export interface SlotData {
  balance: number;
  bet: number;
  win: number;
}

export class SlotModel {
  private data: SlotData;

  constructor(balance = 1000, bet = 10) {
    this.data = { balance, bet, win: 0 };
  }

  snapshot(): SlotData {
    return { ...this.data };
  }

  setBet(bet: number): void {
    if (bet > 0 && bet <= this.data.balance) this.data.bet = bet;
  }

  canSpin(): boolean {
    return this.data.balance >= this.data.bet;
  }

  startSpin(): boolean {
    if (!this.canSpin()) return false;
    this.data.balance -= this.data.bet;
    this.data.win = 0;
    return true;
  }

  applyResult(result: SpinResult): void {
    this.data.win = result.win;
    this.data.balance += result.win;
  }
}
