import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, Medal } from 'lucide-react';

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Protect route
  if (!user) {
    redirect('/login');
  }

  // Fetch all users ordered by total_points descending
  const { data: users, error } = await supabase
    .from('users')
    .select('username, total_points')
    .order('total_points', { ascending: false });

  if (error) {
    console.error('Failed to fetch leaderboard:', error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stadium-light to-background font-sans text-white pb-12">
      {/* Dashboard Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-wider text-yellow-500">
              WORLD CUP 2026
            </h1>
            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
              LEADERBOARD STANDINGS
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle back to Match Feed */}
            <Link href="/">
              <Button
                variant="outline"
                className="rounded-xl border-zinc-800 text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 hover:text-white cursor-pointer flex gap-1.5 items-center text-xs h-9"
              >
                <Calendar className="w-4 h-4" />
                <span>Match Feed</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Leaderboard Table Container */}
      <main className="max-w-3xl mx-auto px-4 mt-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black tracking-tight flex gap-2 items-center">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Global Standings
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            See how your predictions rank against everyone else. Point metrics are recalculated instantly 
            when scorelines are finalized.
          </p>
        </div>

        {/* Standings Card (Pristine White) */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 text-[10px] font-bold tracking-widest uppercase">
                  <th className="py-4 px-6 text-center w-20">Rank</th>
                  <th className="py-4 px-6">Username</th>
                  <th className="py-4 px-6 text-right w-36">Total Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users && users.length > 0 ? (
                  users.map((player, index) => {
                    const rank = index + 1;
                    
                    // Render podium classes
                    let rowClass = 'hover:bg-zinc-50/50 transition-colors';
                    let rankBadge = (
                      <span className="text-xs font-black text-zinc-400">#{rank}</span>
                    );

                    if (rank === 1) {
                      rowClass = 'bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors font-semibold border-l-4 border-l-yellow-500';
                      rankBadge = (
                        <div className="inline-flex items-center justify-center bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-black gap-1 shadow-sm border border-yellow-200">
                          <Trophy className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                          <span>1st</span>
                        </div>
                      );
                    } else if (rank === 2) {
                      rowClass = 'bg-slate-500/5 hover:bg-slate-500/10 transition-colors font-semibold border-l-4 border-l-slate-400';
                      rankBadge = (
                        <div className="inline-flex items-center justify-center bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-black gap-1 shadow-sm border border-slate-200">
                          <Medal className="w-3.5 h-3.5 fill-slate-400 text-slate-400" />
                          <span>2nd</span>
                        </div>
                      );
                    } else if (rank === 3) {
                      rowClass = 'bg-amber-600/5 hover:bg-amber-600/10 transition-colors font-semibold border-l-4 border-l-amber-600';
                      rankBadge = (
                        <div className="inline-flex items-center justify-center bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full text-xs font-black gap-1 shadow-sm border border-amber-200">
                          <Medal className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                          <span>3rd</span>
                        </div>
                      );
                    }

                    return (
                      <tr key={player.username || index} className={rowClass}>
                        <td className="py-4 px-6 text-center">{rankBadge}</td>
                        <td className="py-4 px-6 text-sm font-bold text-zinc-900">
                          {player.username}
                        </td>
                        <td className="py-4 px-6 text-sm font-black text-right text-zinc-800">
                          {player.total_points} PTS
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-xs text-zinc-400 italic">
                      No participants registered in standings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
