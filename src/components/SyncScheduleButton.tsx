'use client';

import { useTransition } from 'react';
import { syncWorldCupFixtures } from '@/app/actions/fixtures';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SyncScheduleButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSync = () => {
    const toastId = toast.loading('Synchronizing World Cup fixtures...');

    startTransition(async () => {
      try {
        const result = await syncWorldCupFixtures();

        if (result.success) {
          toast.success(result.message || 'Fixtures synchronized successfully!', {
            id: toastId,
          });
          router.refresh(); // Refresh page data
        } else {
          toast.error(result.message || 'Fixture synchronization failed.', {
            id: toastId,
          });
        }
      } catch (err: any) {
        console.error('[SyncScheduleButton] Error running action:', err);
        toast.error(err.message || 'Failed to synchronize schedule.', {
          id: toastId,
        });
      }
    });
  };

  return (
    <Button
      onClick={handleSync}
      disabled={isPending}
      className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-zinc-950 font-bold shadow rounded-xl h-10 px-4 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-xs w-full sm:w-auto"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Syncing...' : 'Sync Schedule'}
    </Button>
  );
}
