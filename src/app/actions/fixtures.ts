'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Interface for API-Football v3 Fixture response structure
export interface ApiFootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface ApiFootballResponse {
  get: string;
  parameters: any;
  errors: any[] | Record<string, string>;
  results: number;
  response: ApiFootballFixture[];
}

/**
 * Server Action to pull 2026 World Cup fixtures from API-Football
 * and upsert them safely into the local Supabase matches table.
 */
export async function syncWorldCupFixtures() {
  // 1. Authorize current user session
  const supabaseUserClient = await createClient();
  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized. You must be authenticated to sync fixtures.');
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  const baseUrl = process.env.API_FOOTBALL_URL || 'https://v3.football.api-sports.io';

  if (!apiKey) {
    throw new Error('Missing environment variable API_FOOTBALL_KEY.');
  }

  // 2. Fetch fixtures for World Cup (defaults to 2026, auto fallbacks to 2022 if Free plan limits prevent it)
  let season = process.env.API_FOOTBALL_SEASON || '2026';
  let syncUrl = `${baseUrl}/fixtures?league=1&season=${season}`;
  console.log(`[Sync Fixtures] Fetching from: ${syncUrl}`);

  let apiResponse = await fetch(syncUrl, {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
    },
    next: { revalidate: 0 },
  });

  if (!apiResponse.ok) {
    throw new Error(`API-Football request failed with HTTP ${apiResponse.status}`);
  }

  let responseData: ApiFootballResponse = await apiResponse.json();
  let hasError = responseData.errors && (Array.isArray(responseData.errors) ? responseData.errors.length > 0 : Object.keys(responseData.errors).length > 0);
  let fellBack = false;

  // Intercept subscription error to auto-fallback to 2022 if season is 2026
  if (hasError && season === '2026') {
    const errorStr = JSON.stringify(responseData.errors);
    if (errorStr.toLowerCase().includes('free plans do not have access') || errorStr.toLowerCase().includes('subscription')) {
      console.warn('[Sync Fixtures] 2026 season not accessible on this plan. Retrying with 2022 season as fallback...');
      season = '2022';
      syncUrl = `${baseUrl}/fixtures?league=1&season=${season}`;
      
      apiResponse = await fetch(syncUrl, {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey,
        },
        next: { revalidate: 0 },
      });

      if (!apiResponse.ok) {
        throw new Error(`API-Football fallback request failed with HTTP ${apiResponse.status}`);
      }

      responseData = await apiResponse.json();
      hasError = responseData.errors && (Array.isArray(responseData.errors) ? responseData.errors.length > 0 : Object.keys(responseData.errors).length > 0);
      fellBack = true;
    }
  }

  if (hasError) {
    const errMsg = typeof responseData.errors === 'string'
      ? responseData.errors
      : JSON.stringify(responseData.errors);
    throw new Error(`API-Football subscription/request error: ${errMsg}`);
  }

  const apiFixtures = responseData.response || [];
  console.log(`[Sync Fixtures] Fetched ${apiFixtures.length} matches in total`);

  // 3. Filter specifically for Group Stage matches
  const groupStageFixtures = apiFixtures.filter((item) =>
    item.league?.round?.toLowerCase().includes('group stage')
  );
  console.log(`[Sync Fixtures] Filtered down to ${groupStageFixtures.length} Group Stage matches`);

  if (groupStageFixtures.length === 0) {
    return { success: true, count: 0, message: 'No Group Stage matches found in the retrieved schedule.' };
  }

  // 4. Map API-Football data properties to our internal format
  const mappedMatches = groupStageFixtures.map((item) => {
    let status: 'SCHEDULED' | 'LIVE' | 'FINISHED' = 'SCHEDULED';
    const shortStatus = item.fixture.status.short;

    // Map API-Football statuses to internal statuses
    if (['FT', 'AET', 'PEN'].includes(shortStatus)) {
      status = 'FINISHED';
    } else if (
      ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'].includes(shortStatus)
    ) {
      status = 'LIVE';
    }

    return {
      api_id: item.fixture.id,
      home_team: item.teams.home.name,
      away_team: item.teams.away.name,
      kickoff_time: item.fixture.date,
      status: status,
      actual_home_score: item.goals.home,
      actual_away_score: item.goals.away,
    };
  });

  // 5. Connect to Supabase using service_role key to bypass RLS for administrative changes
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 6. Perform the upsert with api_id as the target conflict index key
  const { error: upsertError } = await supabaseAdmin
    .from('matches')
    .upsert(mappedMatches, { onConflict: 'api_id' });

  if (upsertError) {
    console.error('[Sync Fixtures] Supabase upsert error:', upsertError);
    throw new Error(`Failed to save synchronized fixtures: ${upsertError.message}`);
  }

  console.log(`[Sync Fixtures] Successfully upserted ${mappedMatches.length} fixtures`);

  // Revalidate display paths
  revalidatePath('/');
  revalidatePath('/leaderboard');

  return {
    success: true,
    count: mappedMatches.length,
    message: fellBack
      ? `Successfully synchronized ${mappedMatches.length} Group Stage fixtures (fell back to 2022 World Cup due to Free API plan limitations).`
      : `Successfully synchronized ${mappedMatches.length} Group Stage fixtures.`,
  };
}
