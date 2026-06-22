// Automated Diagnostic Test Script for Phase 2 Prediction Logic
// Run with: npx tsx src/scripts/test-predictions-api.ts

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { submitPrediction } from '../app/actions/predictions';

// 1. Parse and load environment variables from .env.local manually
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value.trim();
        }
      });
    }
  } catch (e) {
    console.error('Warning: Failed to load .env.local file', e);
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer service_role key to bypass RLS for creating/cleaning mock matches, fallback to anon
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-id')) {
  console.log('\n❌ [SETUP ERROR] Please configure real Supabase credentials in your .env.local file first.');
  console.log('Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are set.');
  process.exit(1);
}

// 2. Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_MATCH_IDS = {
  A: 999901, // Future Match
  B: 999902, // Grace Period Match (-5 mins)
  C: 999903, // Expired Match (-11 mins)
  D: 999904, // Finished Match
};

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('🏃 Starting Phase 2 Prediction API Diagnostics...');
  console.log('--------------------------------------------------');

  // A. Fetch a real user ID from public.users to bypass foreign key constraint
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, username')
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error('❌ [SETUP ERROR] No users found in public.users table.');
    console.error('Please register a user in your Supabase Auth app before running this test.');
    process.exit(1);
  }

  const testUserId = users[0].id;
  console.log(`👤 Simulating authenticated user: ${users[0].username} (${testUserId})`);

  // B. Wrap client in a Proxy to mock supabase.auth.getUser()
  const testClient = new Proxy(supabase, {
    get(target, prop, receiver) {
      if (prop === 'auth') {
        return {
          getUser: async () => ({
            data: { user: { id: testUserId, email: 'test-user@example.com' } },
            error: null,
          }),
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  // C. Generate Mock Match records
  const now = Date.now();
  const mockMatches = [
    {
      id: TEST_MATCH_IDS.A,
      home_team: 'Test Country A',
      away_team: 'Test Country B',
      kickoff_time: new Date(now + 24 * 60 * 60 * 1000).toISOString(), // NOW + 1 day
      status: 'SCHEDULED',
    },
    {
      id: TEST_MATCH_IDS.B,
      home_team: 'Test Country C',
      away_team: 'Test Country D',
      kickoff_time: new Date(now - 5 * 60 * 1000).toISOString(), // NOW - 5 mins (Grace period)
      status: 'SCHEDULED',
    },
    {
      id: TEST_MATCH_IDS.C,
      home_team: 'Test Country E',
      away_team: 'Test Country F',
      kickoff_time: new Date(now - 11 * 60 * 1000).toISOString(), // NOW - 11 mins (Expired)
      status: 'SCHEDULED',
    },
    {
      id: TEST_MATCH_IDS.D,
      home_team: 'Test Country G',
      away_team: 'Test Country H',
      kickoff_time: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // NOW - 2 hours
      status: 'FINISHED',
    },
  ];

  console.log('⚡ Inserting mock match records...');
  // Delete first to avoid conflicts in case of a crash in a previous run
  await cleanupDb();

  const { error: insertError } = await supabase.from('matches').insert(mockMatches);
  if (insertError) {
    console.error('❌ Failed to insert mock matches:', insertError.message);
    console.error('Note: If using NEXT_PUBLIC_SUPABASE_ANON_KEY instead of SUPABASE_SERVICE_ROLE_KEY, match insertion will fail due to RLS policies.');
    process.exit(1);
  }
  console.log('✅ Mock matches inserted successfully.');

  let testSuitePassed = true;

  // D. Execution Tests
  console.log('\n🔍 Running Scenario Tests...\n');

  // Test 1: Match A (Future Match) - Expected SUCCESS
  try {
    const res = await submitPrediction(TEST_MATCH_IDS.A, 2, 1, testClient);
    if (res.success && res.prediction.predicted_home_score === 2) {
      console.log('🟢 Scenario A (Future Match): PASS (SUCCESS)');
    } else {
      console.log('🔴 Scenario A (Future Match): FAIL (Submission returned unexpected response)');
      testSuitePassed = false;
    }
  } catch (err: any) {
    console.log(`🔴 Scenario A (Future Match): FAIL (Threw error: ${err.message})`);
    testSuitePassed = false;
  }

  // Test 2: Match B (Grace Period) - Expected SUCCESS
  try {
    const res = await submitPrediction(TEST_MATCH_IDS.B, 1, 1, testClient);
    if (res.success) {
      console.log('🟢 Scenario B (Grace Period Match -5 mins): PASS (SUCCESS)');
    } else {
      console.log('🔴 Scenario B (Grace Period Match -5 mins): FAIL (Submission returned unexpected response)');
      testSuitePassed = false;
    }
  } catch (err: any) {
    console.log(`🔴 Scenario B (Grace Period Match -5 mins): FAIL (Threw error: ${err.message})`);
    testSuitePassed = false;
  }

  // Test 3: Match C (Expired Match -11 mins) - Expected FAILURE (lockout window)
  try {
    await submitPrediction(TEST_MATCH_IDS.C, 0, 3, testClient);
    console.log('🔴 Scenario C (Expired Match -11 mins): FAIL (Action allowed prediction after lockout window)');
    testSuitePassed = false;
  } catch (err: any) {
    if (err.message === 'Prediction window has closed for this match.') {
      console.log('🟢 Scenario C (Expired Match -11 mins): PASS (Blocked with correct message)');
    } else {
      console.log(`🔴 Scenario C (Expired Match -11 mins): FAIL (Blocked but with wrong message: "${err.message}")`);
      testSuitePassed = false;
    }
  }

  // Test 4: Match D (Finished Match) - Expected FAILURE (status finished)
  try {
    await submitPrediction(TEST_MATCH_IDS.D, 1, 0, testClient);
    console.log('🔴 Scenario D (Finished Match): FAIL (Action allowed prediction for finished match)');
    testSuitePassed = false;
  } catch (err: any) {
    if (err.message === 'Cannot predict finished matches.') {
      console.log('🟢 Scenario D (Finished Match): PASS (Blocked with correct message)');
    } else {
      console.log(`🔴 Scenario D (Finished Match): FAIL (Blocked but with wrong message: "${err.message}")`);
      testSuitePassed = false;
    }
  }

  // Test 5: Overwrite/Upsert test - Expected SUCCESS & single database row
  console.log('\n⚡ Running Upsert Overwrite Check...');
  try {
    // Attempt to overwrite Match A prediction with a new score
    const res = await submitPrediction(TEST_MATCH_IDS.A, 3, 2, testClient);
    if (res.success && res.prediction.predicted_home_score === 3) {
      // Query database directly to count prediction rows for this user and Match A
      const { data: preds, error: fetchErr } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', testUserId)
        .eq('match_id', TEST_MATCH_IDS.A);

      if (fetchErr) {
        throw fetchErr;
      }

      if (preds && preds.length === 1 && preds[0].predicted_home_score === 3) {
        console.log('🟢 Upsert Overwrite Check: PASS (Upserted cleanly, single row maintained)');
      } else {
        console.log(`🔴 Upsert Overwrite Check: FAIL (Expected exactly 1 row with score 3, found ${preds?.length} rows)`);
        testSuitePassed = false;
      }
    } else {
      console.log('🔴 Upsert Overwrite Check: FAIL (Overwriting request failed)');
      testSuitePassed = false;
    }
  } catch (err: any) {
    console.log(`🔴 Upsert Overwrite Check: FAIL (Threw error: ${err.message})`);
    testSuitePassed = false;
  }

  // E. Cleanup
  console.log('\n🧹 Cleaning up test database records...');
  await cleanupDb();
  console.log('✨ Cleanup finished.');

  console.log('--------------------------------------------------');
  if (testSuitePassed) {
    console.log('🏆 DIAGNOSTICS COMPLETE: ALL SCENARIOS PASSED!');
  } else {
    console.log('❌ DIAGNOSTICS COMPLETE: SOME SCENARIOS FAILED.');
  }
  console.log('--------------------------------------------------');
}

async function cleanupDb() {
  const matchIds = Object.values(TEST_MATCH_IDS);
  // Due to cascade delete, deleting matches cleans up predictions automatically
  await supabase.from('matches').delete().in('id', matchIds);
}

runTests().catch((err) => {
  console.error('Unhandled error running diagnostics:', err);
  process.exit(1);
});
