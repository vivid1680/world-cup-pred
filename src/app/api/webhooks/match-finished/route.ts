import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * Webhook route handler designed to receive finished whistle alerts from
 * sports providers and automatically evaluate scores and points distributions.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Extract fields, supporting both snake_case and camelCase for API flexibility
    const matchId = body.match_id ?? body.matchId;
    const actualHomeScore = body.actual_home_score ?? body.actualHomeScore;
    const actualAwayScore = body.actual_away_score ?? body.actualAwayScore;

    if (matchId === undefined || actualHomeScore === undefined || actualAwayScore === undefined) {
      return NextResponse.json(
        { error: 'Missing parameters. Ensure match_id, actual_home_score, and actual_away_score are provided.' },
        { status: 400 }
      );
    }

    const mId = parseInt(matchId, 10);
    const homeScore = parseInt(actualHomeScore, 10);
    const awayScore = parseInt(actualAwayScore, 10);

    if (isNaN(mId) || isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
      return NextResponse.json(
        { error: 'Invalid parameters. Match ID and score values must be positive integers.' },
        { status: 400 }
      );
    }

    // Connect to Supabase with the service_role key to authorize match/points update operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Call PostgreSQL RPC function to process settlement in a single isolated transaction
    const { error: rpcError } = await supabase.rpc('settle_match_rpc', {
      p_match_id: mId,
      p_actual_home_score: homeScore,
      p_actual_away_score: awayScore,
    });

    if (rpcError) {
      console.error(`[Match Finished Webhook] RPC failed for Match ID ${mId}:`, rpcError);
      return NextResponse.json(
        { error: `Database RPC failed: ${rpcError.message}` },
        { status: 500 }
      );
    }

    // Revalidate relevant page caches to update content in real time
    revalidatePath('/');
    revalidatePath('/leaderboard');

    return NextResponse.json({
      success: true,
      message: `Match ${mId} score settled and user points updated successfully.`,
    });
  } catch (err: any) {
    console.error('[Match Finished Webhook] Webhook request parsing crashed:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
