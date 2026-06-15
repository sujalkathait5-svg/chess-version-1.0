export const MoveType = {
  Capture: 0,
  Castling: 1,
  Promotion: 2,
  Check: 3,
  CheckMate: 4,
  BasicMove: 5,
} as const;
export type MoveType = typeof MoveType[keyof typeof MoveType];
