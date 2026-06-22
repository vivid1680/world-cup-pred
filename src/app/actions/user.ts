'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to update the authenticated user's username.
 * Verifies active session, checks unique constraint errors, and revalidates caches.
 */
export async function updateUsername(newUsername: string) {
  const trimmed = newUsername.trim();

  if (!trimmed) {
    throw new Error('Username cannot be empty.');
  }

  if (trimmed.length < 3) {
    throw new Error('Username must be at least 3 characters long.');
  }

  if (trimmed.length > 20) {
    throw new Error('Username must be 20 characters or less.');
  }

  // Alphanumeric, underscores, and hyphens only
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens.');
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be authenticated to change your username.');
  }

  // Attempt to update the user record in public.users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ username: trimmed })
    .eq('id', user.id);

  if (updateError) {
    console.error(`[Update Username] Error for user ID ${user.id}:`, updateError);
    
    // PostgreSQL duplicate key violation error code (23505)
    if (updateError.code === '23505' || updateError.message?.includes('users_username_key')) {
      throw new Error('Username already taken.');
    }
    
    throw new Error(`Failed to change username: ${updateError.message}`);
  }

  // Revalidate pages where username is displayed
  revalidatePath('/');
  revalidatePath('/leaderboard');

  return { success: true };
}
