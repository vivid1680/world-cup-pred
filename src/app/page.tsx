import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { getMatchesWithUserPredictions } from '@/app/actions/predictions';
import { MatchFeed } from '@/components/match-feed';
import { Button } from '@/components/ui/button';
import { LogOut, Trophy, User as UserIcon, Award } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login');
  }

  // Fetch the public user profile to display current prediction points
  const { data: profile } = await supabase
    .from('users')
    .select('username, total_points')
    .eq('id', user.id)
    .single();

  // Fetch all matches joined with predictions
  const matches = await getMatchesWithUserPredictions();

  const handleSignOut = async () => {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stadium-light to-background font-sans text-white pb-12">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-wider text-yellow-500">
              WORLD CUP 2026
            </h1>
            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
              PREDICTOR DASHBOARD
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Leaderboard Link */}
            <Link href="/leaderboard">
              <Button
                variant="outline"
                className="rounded-xl border-zinc-800 text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 hover:text-white cursor-pointer flex gap-1.5 items-center text-xs h-9"
              >
                <Award className="w-4 h-4 text-yellow-500" />
                <span className="hidden sm:inline">Leaderboard</span>
              </Button>
            </Link>

            {/* Points Badge */}
            <div className="flex items-center gap-1.5 bg-yellow-500 text-zinc-950 px-3 py-1.5 rounded-xl border border-yellow-400 font-extrabold text-xs shadow-md">
              <Trophy className="w-4 h-4" />
              <span>{profile?.total_points ?? 0} PTS</span>
            </div>

            {/* Profile Info */}
            <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-300">
              <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>{profile?.username ?? 'User'}</span>
            </div>

            {/* Logout Action */}
            <form action={handleSignOut}>
              <Button
                type="submit"
                variant="outline"
                size="icon"
                className="rounded-xl border-zinc-800 text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 hover:text-white cursor-pointer h-9 w-9"
              >
                <LogOut className="w-4 h-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Feed Container */}
      <main className="max-w-6xl mx-auto px-4 mt-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black tracking-tight">Fixtures & Predictions</h2>
          <p className="text-xs text-zinc-300 max-w-lg leading-relaxed">
            Submit your predictions below. Predictions lock exactly <strong>10 minutes after kickoff</strong>. 
            Score points for matching exact scorelines or overall match results!
          </p>
        </div>

        <MatchFeed initialMatches={matches} />
      </main>
    </div>
  );
}
