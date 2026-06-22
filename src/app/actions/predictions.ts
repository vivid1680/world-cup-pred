'use server';

import { createClient } from '@/utils/supabase/server';
import { Prediction } from '@/types/database';

/**
 * Submits or updates a prediction for a match.
 * Enforces a lock out window of kickoff_time + 10 minutes.
 */
export async function submitPrediction(
  matchId: number,
  homeScore: number,
  awayScore: number,
  supabaseClientForTesting?: any
) {
  // Validate basic score limits
  if (homeScore < 0 || awayScore < 0) {
    throw new Error('Scores must be non-negative integers.');
  }

  const supabase = supabaseClientForTesting || await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be authenticated to submit predictions.');
  }

  // Fetch match details to verify kickoff time
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('kickoff_time, status')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    throw new Error('Match not found.');
  }

  if (match.status === 'FINISHED') {
    throw new Error('Cannot predict finished matches.');
  }

  const kickoff = new Date(match.kickoff_time);
  // Lockout time is kickoff time + 10 minutes
  const lockoutTime = new Date(kickoff.getTime() + 10 * 60 * 1000);
  const now = new Date();

  if (now > lockoutTime) {
    throw new Error('Prediction window has closed for this match.');
  }

  // Upsert user prediction
  const { data, error: upsertError } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: user.id,
        match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
      },
      {
        onConflict: 'user_id,match_id',
      }
    )
    .select()
    .single();

  if (upsertError) {
    console.error('Failed to upsert prediction:', upsertError);
    throw new Error(`Failed to save prediction: ${upsertError.message}`);
  }

  return { success: true, prediction: data as Prediction };
}

/**
 * Fetches all matches and joins the current authenticated user's prediction (if any).
 */
export async function getMatchesWithUserPredictions(supabaseClientForTesting?: any) {
  const supabase = supabaseClientForTesting || await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('matches')
    .select(`
      *,
      predictions!left (
        id,
        user_id,
        match_id,
        predicted_home_score,
        predicted_away_score,
        points_awarded,
        created_at
      )
    `)
    .order('kickoff_time', { ascending: true });

  // Filter left-joined predictions on PostgREST to retrieve only current user's prediction
  if (user) {
    query = query.eq('predictions.user_id', user.id);
  } else {
    // If guest, force left join to be empty/null by matching an impossible criteria
    query = query.is('predictions.id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch matches with predictions:', error);
    throw new Error(`Failed to load matches: ${error.message}`);
  }

  // Clean join representation for easier UI usage:
  // Maps predictions array to a single optional `user_prediction` property.
  return (data as any[]).map((match: any) => {
    const rawPredictions = match.predictions as any[];
    const userPrediction = rawPredictions && rawPredictions.length > 0
      ? (rawPredictions[0] as Prediction)
      : null;

    // Destructure to remove the raw list join
    const { predictions, ...matchProperties } = match;

    return {
      ...matchProperties,
      user_prediction: userPrediction,
    };
  });
}
