'use server';

import { createClient } from '@/utils/supabase/server';
import { calculatePoints } from '@/utils/points';
import { revalidatePath } from 'next/cache';

/**
 * Administrative action to enter match scores, close/finish the match,
 * distribute points to participants, and update the global leaderboard metrics.
 */
export async function settleMatch(
  matchId: number,
  finalHomeScore: number,
  finalAwayScore: number,
  supabaseClientForTesting?: any
) {
  // Simple validation
  if (finalHomeScore < 0 || finalAwayScore < 0) {
    throw new Error('Scores must be non-negative integers.');
  }

  const supabase = supabaseClientForTesting || await createClient();

  // 1. Update the match score and status
  const { error: matchError } = await supabase
    .from('matches')
    .update({
      actual_home_score: finalHomeScore,
      actual_away_score: finalAwayScore,
      status: 'FINISHED',
    })
    .eq('id', matchId);

  if (matchError) {
    console.error(`[Settle Match] Failed to update match ID ${matchId}:`, matchError);
    throw new Error(`Failed to update match: ${matchError.message}`);
  }

  // 2. Fetch all predictions associated with this match
  const { data: predictions, error: predsError } = await supabase
    .from('predictions')
    .select('id, user_id, predicted_home_score, predicted_away_score')
    .eq('match_id', matchId);

  if (predsError) {
    console.error('[Settle Match] Failed to fetch predictions:', predsError);
    throw new Error(`Failed to fetch predictions: ${predsError.message}`);
  }

  if (predictions && predictions.length > 0) {
    // 3. Process score calculations and save points awarded
    for (const pred of predictions) {
      const points = calculatePoints(
        pred.predicted_home_score,
        pred.predicted_away_score,
        finalHomeScore,
        finalAwayScore
      );

      const { error: updatePredError } = await supabase
        .from('predictions')
        .update({ points_awarded: points })
        .eq('id', pred.id);

      if (updatePredError) {
        console.error(`[Settle Match] Failed to update points for prediction ${pred.id}:`, updatePredError);
      }
    }

    // 4. Update total points in public.users for every affected user
    const affectedUserIds = Array.from(new Set((predictions || []).map((p: any) => p.user_id)));

    for (const userId of affectedUserIds) {
      const { data: userPreds, error: sumError } = await supabase
        .from('predictions')
        .select('points_awarded')
        .eq('user_id', userId);

      if (sumError) {
        console.error(`[Settle Match] Failed to sum predictions for user ${userId}:`, sumError);
        continue; // Continue updating other users
      }

      const newTotal = (userPreds || []).reduce(
        (sum: number, pred: any) => sum + (pred.points_awarded ?? 0),
        0
      );

      const { error: updateUserError } = await supabase
        .from('users')
        .update({ total_points: newTotal })
        .eq('id', userId);

      if (updateUserError) {
        console.error(`[Settle Match] Failed to update total score for user ${userId}:`, updateUserError);
      }
    }
  }

  // 5. Revalidate cache for the dashboard and the leaderboard
  if (!supabaseClientForTesting) {
    revalidatePath('/');
    revalidatePath('/leaderboard');
  }

  return { success: true };
}
