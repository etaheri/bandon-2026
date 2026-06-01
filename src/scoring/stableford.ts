export function holePoints(input: { gross: number; par: number; strokes: number }): number {
  const net = input.gross - input.strokes;
  return Math.max(0, input.par - net + 2);
}
