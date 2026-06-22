import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { ProfileSettings } from '@/components/profile-settings';
import { Button } from '@/components/ui/button';
import { LogOut, Trophy, Award, ArrowLeft } from 'lucide-react';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login');
  }

  // Fetch the public user profile to display current prediction points and username
  const { data: profile } = await supabase
    .from('users')
    .select('username, total_points')
    .eq('id', user.id)
    .single();

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
            <Link href="/">
              <h1 className="text-xl font-black tracking-wider text-yellow-500 hover:text-yellow-600 transition-colors">
                WORLD CUP 2026
              </h1>
            </Link>
            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
              PREDICTOR DASHBOARD
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Dashboard Link */}
            <Link href="/">
              <Button
                variant="outline"
                className="rounded-xl border-zinc-800 text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 hover:text-white cursor-pointer flex gap-1.5 items-center text-xs h-9"
              >
                <ArrowLeft className="w-4 h-4 text-yellow-500" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Button>
            </Link>

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

      {/* Settings Form Container */}
      <main className="max-w-6xl mx-auto px-4 mt-8 flex flex-col items-center justify-center gap-6">
        <div className="w-full max-w-md flex flex-col gap-2">
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to matches
          </Link>
          <h2 className="text-2xl font-black tracking-tight mt-2">Account Settings</h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Manage your credentials and tournament display profile.
          </p>
        </div>

        <ProfileSettings currentUsername={profile?.username ?? ''} />
      </main>
    </div>
  );
}
