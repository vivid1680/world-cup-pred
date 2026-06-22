/**
 * Calculates user points based on predicted and actual match scores.
 * 
 * Rules:
 * 1. Exact Match: 3 points (predicted home === actual home AND predicted away === actual away)
 * 2. Correct Outcome: 1 point (correctly predicted a home win, away win, or draw, but not the exact score)
 * 3. Otherwise: 0 points
 */
export function calculatePoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): number {
  // Rule 1: Exact Match (3 points)
  if (predHome === actualHome && predAway === actualAway) {
    return 3;
  }

  // Rule 2: Correct Outcome (1 point)
  // Math.sign(predHome - predAway) calculates the outcome direction:
  // - Positive (>0) means Home Win
  // - Negative (<0) means Away Win
  // - Zero (0) means Draw
  if (Math.sign(predHome - predAway) === Math.sign(actualHome - actualAway)) {
    return 1;
  }

  // Rule 3: No points
  return 0;
}
