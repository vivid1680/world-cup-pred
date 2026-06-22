'use client';

import { useState, useTransition } from 'react';
import { syncWorldCupFixtures } from '@/app/actions/fixtures';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw, Database } from 'lucide-react';

export function SyncScheduleButton() {
  const [isPending, startTransition] = useTransition();
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const handleSync = () => {
    toast.loading('Synchronizing World Cup 2026 fixtures...', { id: 'sync-fixtures' });

    startTransition(async () => {
      try {
        const result = await syncWorldCupFixtures();

        if (result.success) {
          setLastSynced(new Date().toLocaleTimeString());
          toast.success(result.message || 'Fixtures synced successfully!', {
            id: 'sync-fixtures',
          });
        } else {
          toast.error(result.message || 'Fixture synchronization failed.', {
            id: 'sync-fixtures',
          });
        }
      } catch (err: any) {
        console.error('[SyncScheduleButton] Error running action:', err);
        toast.error(err.message || 'Failed to synchronize schedule.', {
          id: 'sync-fixtures',
        });
      }
    });
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 backdrop-blur-md shadow-xl">
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-zinc-800">
        <Database className="w-5 h-5 text-yellow-500" />
        <div>
          <h3 className="text-sm font-bold text-zinc-100">Fixture Integration</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">API-Football Schedule Pipeline</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          Pulls the latest official 2026 FIFA World Cup schedules, kickoff times, and statuses (Group Stage only) from API-Football, safely updating match details without duplicate predictions.
        </p>

        <Button
          onClick={handleSync}
          disabled={isPending}
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-zinc-950 font-bold shadow rounded-lg h-10 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Syncing...' : 'Sync World Cup Schedule'}
        </Button>

        {lastSynced && (
          <p className="text-[10px] text-zinc-500 text-center">
            Last synchronization run at <span className="text-zinc-400 font-medium">{lastSynced}</span>
          </p>
        )}
      </div>
    </div>
  );
}
