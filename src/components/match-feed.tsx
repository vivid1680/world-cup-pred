'use client';

import { useState, useMemo } from 'react';
import { MatchWithPrediction } from '@/types/database';
import { MatchCard } from './match-card';
import { submitPrediction } from '@/app/actions/predictions';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, CalendarRange, CheckCircle2, History } from 'lucide-react';
import { SyncScheduleButton } from './SyncScheduleButton';

interface MatchFeedProps {
  initialMatches: MatchWithPrediction[];
}

type FilterTab = 'all' | 'pending' | 'completed' | 'results';

export function MatchFeed({ initialMatches }: MatchFeedProps) {
  const [matches, setMatches] = useState<MatchWithPrediction[]>(initialMatches);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Handle saving prediction via Server Action and update state locally to avoid reload latency
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

  // Filtered matches calculation based on active tab
  const filteredMatches = useMemo(() => {
    const now = new Date();

    return matches.filter((match) => {
      const kickoff = new Date(match.kickoff_time);
      const lockoutTime = new Date(kickoff.getTime() + 10 * 60 * 1000);
      const isPastLockout = now > lockoutTime;
      const isLocked = isPastLockout || match.status === 'FINISHED' || match.status === 'LIVE';

      switch (activeTab) {
        case 'pending':
          // Scheduled matches that are not locked and don't have predictions yet
          return match.status === 'SCHEDULED' && !isLocked && !match.user_prediction;
        case 'completed':
          // Any match where the user has already submitted a prediction
          return !!match.user_prediction;
        case 'results':
          // Matches that have completed or are currently live
          return match.status === 'FINISHED' || match.status === 'LIVE';
        case 'all':
        default:
          return true;
      }
    });
  }, [matches, activeTab]);

  // Tab counters helper
  const counts = useMemo(() => {
    const now = Date.now();
    return {
      all: matches.length,
      pending: matches.filter(
        (m) =>
          m.status === 'SCHEDULED' &&
          now <= new Date(m.kickoff_time).getTime() + 10 * 60 * 1000 &&
          !m.user_prediction
      ).length,
      completed: matches.filter((m) => !!m.user_prediction).length,
      results: matches.filter((m) => m.status === 'FINISHED' || m.status === 'LIVE').length,
    };
  }, [matches]);

  const tabs: { id: FilterTab; label: string; icon: any; count: number }[] = [
    { id: 'all', label: 'All Matches', icon: LayoutGrid, count: counts.all },
    { id: 'pending', label: 'To Predict', icon: CalendarRange, count: counts.pending },
    { id: 'completed', label: 'Predicted', icon: CheckCircle2, count: counts.completed },
    { id: 'results', label: 'Results', icon: History, count: counts.results },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Interactive Tabs Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex overflow-x-auto gap-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-yellow-500 text-zinc-950 shadow-md transform scale-[1.02]'
                    : 'bg-zinc-900/60 border border-zinc-800 text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <Badge
                  variant="secondary"
                  className={`ml-1 px-1.5 py-0.25 text-[10px] rounded-md font-black ${
                    isActive
                      ? 'bg-zinc-950 text-white'
                      : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'
                  }`}
                >
                  {tab.count}
                </Badge>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-4 sm:px-0">
          <SyncScheduleButton />
        </div>
      </div>

      {/* Feed List Grid */}
      {filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onSavePrediction={handleSavePrediction}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-sm">
          <span className="text-4xl mb-3">⚽</span>
          <h3 className="text-sm font-bold text-zinc-300">No Matches Found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-[250px]">
            {activeTab === 'pending'
              ? "Awesome! You've submitted predictions for all available fixtures."
              : activeTab === 'completed'
              ? 'You have not submitted predictions for any matches yet.'
              : activeTab === 'results'
              ? 'No live or finished match results available.'
              : 'There are no fixtures currently scheduled.'}
          </p>
        </div>
      )}
    </div>
  );
}
