'use client';

import { useState, useTransition } from 'react';
import { updateUsername } from '@/app/actions/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { User, Check } from 'lucide-react';

interface ProfileSettingsProps {
  currentUsername: string;
}

export function ProfileSettings({ currentUsername }: ProfileSettingsProps) {
  const [username, setUsername] = useState<string>(currentUsername);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim();

    if (cleanUsername === currentUsername) {
      toast.info('No changes made to your username.');
      return;
    }

    if (!cleanUsername) {
      toast.error('Username cannot be empty.');
      return;
    }

    startTransition(async () => {
      try {
        await updateUsername(cleanUsername);
        toast.success('Username updated successfully!');
      } catch (err: any) {
        // This will cleanly catch unique constraint violations thrown as "Username already taken."
        toast.error(err.message || 'Failed to update username.');
      }
    });
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 backdrop-blur-md shadow-xl text-white">
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-zinc-800">
        <User className="w-5 h-5 text-yellow-500" />
        <div>
          <h3 className="text-sm font-bold text-zinc-100">Profile Settings</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Customize your prediction profile</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="username" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Username
          </label>
          <Input
            id="username"
            type="text"
            placeholder="Enter username"
            disabled={isPending}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border-zinc-800 bg-zinc-950 text-zinc-100 placeholder-zinc-600 focus-visible:ring-yellow-500 rounded-xl h-11"
          />
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Must be 3 to 20 characters. Can only contain letters, numbers, underscores, and hyphens.
          </p>
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-zinc-950 font-bold shadow rounded-xl h-11 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
        >
          {isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
          ) : (
            <>
              <Check className="w-4 h-4" /> Update Username
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
