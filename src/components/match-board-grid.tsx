'use client';

import { useState } from 'react';
import { MatchWithPrediction } from '@/types/database';
import { MatchCard } from './match-card';
import { submitPrediction } from '@/app/actions/predictions';

interface MatchBoardGridProps {
  initialMatches: MatchWithPrediction[];
}

export function MatchBoardGrid({ initialMatches }: MatchBoardGridProps) {
  const [matches, setMatches] = useState<MatchWithPrediction[]>(initialMatches);

  const handleSavePrediction = async (
    matchId: number,
    homeScore: number,
    awayScore: number
  ) => {
    const res = await submitPrediction(matchId, homeScore, awayScore);
    
    if (res.success && res.prediction) {
      setMatches((prevMatches) =>
        prevMatches.map((m) =>
          m.id === matchId
            ? { ...m, user_prediction: res.prediction }
            : m
        )
      );
    }
  };

  return (
    <div>
      {matches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onSavePrediction={handleSavePrediction}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-900/20">
          <span className="text-3xl mb-2">🏁</span>
          <h4 className="text-sm font-bold text-zinc-300">No Scheduled Fixtures</h4>
          <p className="text-xs text-zinc-500 mt-1">There are no currently scheduled matches open for predictions.</p>
        </div>
      )}
    </div>
  );
}
