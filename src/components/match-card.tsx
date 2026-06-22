'use client';

import { useEffect, useState, useTransition } from 'react';
import { MatchWithPrediction } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Lock, Save, Trophy } from 'lucide-react';

interface MatchCardProps {
  match: MatchWithPrediction;
  onSavePrediction: (matchId: number, homeScore: number, awayScore: number) => Promise<void>;
}

// Simple country to emoji flag mapping
const getFlagEmoji = (countryName: string): string => {
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    'United States': '🇺🇸',
    Mexico: '🇲🇽',
    Canada: '🇨🇦',
    Argentina: '🇦🇷',
    Brazil: '🇧🇷',
    France: '🇫🇷',
    England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    Spain: '🇪🇸',
    Germany: '🇩🇪',
    Italy: '🇮🇹',
    Portugal: '🇵🇹',
    Netherlands: '🇳🇱',
    Belgium: '🇧🇪',
    Croatia: '🇭🇷',
    Morocco: '🇲🇦',
    Japan: '🇯🇵',
    'South Korea': '🇰🇷',
    Senegal: '🇸🇳',
    Uruguay: '🇺🇾',
    Colombia: '🇨🇴',
    Saudi_Arabia: '🇸🇦',
    'Saudi Arabia': '🇸🇦',
  };

  const normalized = countryName.trim();
  return flags[normalized] || '⚽';
};

export function MatchCard({ match, onSavePrediction }: MatchCardProps) {
  const [homePrediction, setHomePrediction] = useState<string>(
    match.user_prediction?.predicted_home_score !== undefined
      ? String(match.user_prediction.predicted_home_score)
      : ''
  );
  const [awayPrediction, setAwayPrediction] = useState<string>(
    match.user_prediction?.predicted_away_score !== undefined
      ? String(match.user_prediction.predicted_away_score)
      : ''
  );

  const [isPending, startTransition] = useTransition();
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // Sync state if initial predictions change
  useEffect(() => {
    if (match.user_prediction) {
      setHomePrediction(String(match.user_prediction.predicted_home_score));
      setAwayPrediction(String(match.user_prediction.predicted_away_score));
    }
  }, [match.user_prediction]);

  // Lockout logic: checks if current time is past kickoff_time + 10 mins, or if match is LIVE/FINISHED
  useEffect(() => {
    const checkLock = () => {
      const kickoff = new Date(match.kickoff_time);
      const lockoutTime = new Date(kickoff.getTime() + 10 * 60 * 1000);
      const now = new Date();
      
      const isPastTime = now > lockoutTime;
      const isEndedOrLive = match.status === 'FINISHED' || match.status === 'LIVE';
      
      setIsLocked(isPastTime || isEndedOrLive);
    };

    checkLock();
    // Check lock state every 10 seconds dynamically
    const interval = setInterval(checkLock, 10000);
    return () => clearInterval(interval);
  }, [match.kickoff_time, match.status]);

  const handleSave = () => {
    if (homePrediction.trim() === '' || awayPrediction.trim() === '') {
      toast.error('Please enter both scores to save your prediction.');
      return;
    }

    const home = parseInt(homePrediction, 10);
    const away = parseInt(awayPrediction, 10);

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      toast.error('Scores must be positive numbers.');
      return;
    }

    startTransition(async () => {
      try {
        await onSavePrediction(match.id, home, away);
        toast.success('Prediction saved successfully!');
      } catch (err: any) {
        toast.error(err.message || 'Failed to submit prediction.');
      }
    });
  };

  // Format date helper
  const formatKickoff = (isoString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-md transition-all hover:shadow-lg">
      {/* Top Banner (Status and Kickoff) */}
      <div className="flex items-center justify-between bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500 border-b border-zinc-100">
        <span>{formatKickoff(match.kickoff_time)}</span>
        <div className="flex items-center gap-1.5">
          {match.status === 'FINISHED' && (
            <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 text-[10px] font-bold">
              FINISHED
            </Badge>
          )}
          {match.status === 'LIVE' && (
            <Badge className="bg-red-600 text-white text-[10px] font-bold animate-pulse">
              LIVE
            </Badge>
          )}
          {match.status === 'SCHEDULED' && !isLocked && (
            <Badge variant="outline" className="text-zinc-600 border-zinc-300 text-[10px] font-bold">
              OPEN
            </Badge>
          )}
          {isLocked && match.status !== 'FINISHED' && match.status !== 'LIVE' && (
            <Badge variant="destructive" className="bg-amber-600 text-white text-[10px] font-bold flex gap-1 items-center">
              <Lock className="w-3 h-3" /> LOCKED
            </Badge>
          )}
        </div>
      </div>

      {/* Main Body (Teams and Scores) */}
      <div className="p-5 flex flex-col gap-5">
        <div className="grid grid-cols-7 items-center">
          {/* Home Team */}
          <div className="col-span-3 flex flex-col items-center justify-center text-center gap-1">
            <span className="text-4xl" role="img" aria-label={match.home_team}>
              {getFlagEmoji(match.home_team)}
            </span>
            <span className="text-sm font-bold tracking-tight line-clamp-1">{match.home_team}</span>
          </div>

          {/* VS Divider or Actual Match Score */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            {match.status !== 'SCHEDULED' ? (
              <div className="text-xl font-extrabold text-zinc-800 tracking-tight bg-zinc-100 px-2 py-1 rounded">
                {match.home_score} - {match.away_score}
              </div>
            ) : (
              <span className="text-xs font-black text-zinc-400">VS</span>
            )}
          </div>

          {/* Away Team */}
          <div className="col-span-3 flex flex-col items-center justify-center text-center gap-1">
            <span className="text-4xl" role="img" aria-label={match.away_team}>
              {getFlagEmoji(match.away_team)}
            </span>
            <span className="text-sm font-bold tracking-tight line-clamp-1">{match.away_team}</span>
          </div>
        </div>

        {/* Prediction Input Form */}
        <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-zinc-500 font-bold mb-1">HOME PREDICTION</span>
              <Input
                type="number"
                min="0"
                placeholder="-"
                disabled={isLocked || isPending}
                value={homePrediction}
                onChange={(e) => setHomePrediction(e.target.value)}
                className="w-16 text-center text-lg font-bold border-zinc-300 focus-visible:ring-yellow-500 h-10 bg-white"
              />
            </div>

            <div className="text-zinc-300 font-semibold self-end pb-2">:</div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] text-zinc-500 font-bold mb-1">AWAY PREDICTION</span>
              <Input
                type="number"
                min="0"
                placeholder="-"
                disabled={isLocked || isPending}
                value={awayPrediction}
                onChange={(e) => setAwayPrediction(e.target.value)}
                className="w-16 text-center text-lg font-bold border-zinc-300 focus-visible:ring-yellow-500 h-10 bg-white"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-center mt-1">
            {isLocked ? (
              <div className="flex flex-col items-center gap-1">
                {match.user_prediction ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">Your prediction</span>
                    <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
                      {match.user_prediction.predicted_home_score} - {match.user_prediction.predicted_away_score}
                    </span>
                    {match.user_prediction.points_awarded !== null && (
                      <span className="text-xs font-extrabold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200 flex gap-1 items-center mt-1">
                        <Trophy className="w-3.5 h-3.5 text-yellow-500" /> +{match.user_prediction.points_awarded} pts
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-zinc-400 italic">No prediction submitted</span>
                )}
              </div>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isPending}
                className="w-full max-w-[200px] bg-yellow-500 hover:bg-yellow-600 text-zinc-950 font-bold shadow transition-all duration-200 flex gap-2 rounded-lg cursor-pointer h-10"
              >
                {isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Prediction
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
