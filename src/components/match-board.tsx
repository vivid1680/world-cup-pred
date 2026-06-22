import { getMatchesWithUserPredictions } from '@/app/actions/predictions';
import { MatchBoardGrid } from './match-board-grid';

/**
 * Server Component: Live Schedule Board
 * Fetches all scheduled matches, orders them by kickoff time ascending,
 * and renders a client-side wrapper to manage state and prediction saves.
 */
export async function MatchBoard() {
  // Fetch all matches with active user predictions
  const allMatches = await getMatchesWithUserPredictions();

  // Filter specifically for SCHEDULED matches as requested
  const scheduledMatches = allMatches
    .filter((match) => match.status === 'SCHEDULED')
    // Ensure kickoff time ordering is strictly ascending
    .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());

  return (
    <div className="w-full flex flex-col gap-4">
      <h3 className="text-lg font-bold text-zinc-300 flex items-center gap-2">
        📅 Live Schedule Board
      </h3>
      <MatchBoardGrid initialMatches={scheduledMatches} />
    </div>
  );
}
