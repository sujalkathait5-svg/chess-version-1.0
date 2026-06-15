// frontend/src/services/premoveService.ts

export interface Premove {
  source: string;
  target: string;
  promotion?: string;
}

export class PremoveService {
  private queue: Premove[] = [];
  private maxPremoves: number;

  constructor(maxPremoves = 3) {
    this.maxPremoves = maxPremoves;
  }

  getQueue(): Premove[] {
    return [...this.queue];
  }

  addPremove(move: Premove): boolean {
    if (this.queue.length >= this.maxPremoves) {
      return false; // Queue full
    }
    // Simple validation: don't allow duplicate source squares in the same queue
    // (A piece can't move twice unless we simulate the board state, which is complex)
    // For MVP, we just accept the move blindly and clear if invalid later.
    this.queue.push(move);
    return true;
  }

  popPremove(): Premove | undefined {
    return this.queue.shift();
  }

  clearQueue(): void {
    this.queue = [];
  }

  // Removes a specific premove by index (e.g. user right-clicks to cancel)
  removePremove(index: number): void {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
    }
  }

  hasPremoves(): boolean {
    return this.queue.length > 0;
  }
}
