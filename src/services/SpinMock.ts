import type { SpinResult } from "../domain/SlotModel";

export const SYMBOLS = [
  "a",
  "k",
  "q",
  "j",
  "ten",
  "scarab",
  "anubis",
  "pharaoh",
] as const;

export function getRandomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export function getRandomGrid(rows = 3, columns = 5): string[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, getRandomSymbol),
  );
}

export function getMockSpinResult(bet: number): SpinResult {
  const symbols = getRandomGrid();
  const jackpot = Math.random() < 0.18;
  if (jackpot) {
    symbols[1] = Array(5).fill("pharaoh");
    return {
      symbols,
      win: bet * 8,
      winningPositions: [0, 1, 2, 3, 4].map((column) => ({ row: 1, column })),
    };
  }

  if (Math.random() < 0.3) {
    const row = Math.floor(Math.random() * 3);
    for (let column = 0; column < 3; column++) symbols[row][column] = "anubis";
    const winningColumns = [0, 1, 2];
    while (
      winningColumns.length < 5 &&
      symbols[row][winningColumns.length] === symbols[row][0]
    ) {
      winningColumns.push(winningColumns.length);
    }
    return {
      symbols,
      win: bet * (winningColumns.length - 1),
      winningPositions: winningColumns.map((column) => ({ row, column })),
    };
  }

  return { symbols, win: 0, winningPositions: [] };
}
