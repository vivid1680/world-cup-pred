// Automated Diagnostic Script to test Points Calculation and SettleMatch Action
// Run with: npx tsx src/scripts/test-settlement.ts

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { settleMatch } from '../app/actions/admin';

// 1. Load environment variables from .env.local
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-id')) {
  console.log('\n❌ [SETUP ERROR] Please configure real Supabase credentials in your .env.local file first.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const TEST_MATCH_ID = 999999;

async function runSettlementTest() {
  console.log('--------------------------------------------------');
  console.log('🏃 Starting SettleMatch API Diagnostics...');
  console.log('--------------------------------------------------');

  // A. Fetch a real user to associate the prediction with
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, username, total_points')
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error('❌ [SETUP ERROR] No users found in public.users table.');
    console.error('Please register a user in your Supabase Auth app before running this test.');
    process.exit(1);
  }

  const testUser = users[0];
  console.log(`👤 Test User: ${testUser.username} (${testUser.id})`);
  console.log(`📊 Initial score: ${testUser.total_points} PTS`);

  // B. Clean up in case of a crash in a previous run
  await cleanupDb();

  // C. Insert a mock match in the past
  console.log('⚡ Inserting mock match (kickoff 30 mins ago)...');
  const mockMatch = {
    id: TEST_MATCH_ID,
    home_team: 'Test City A',
    away_team: 'Test City B',
    kickoff_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'SCHEDULED',
  };

  const { error: insertError } = await supabase.from('matches').insert(mockMatch);
  if (insertError) {
    console.error('❌ Failed to insert mock match:', insertError.message);
    process.exit(1);
  }

  // D. Insert a prediction (e.g. Predicted score: 2 - 1)
  console.log('⚡ Inserting mock prediction: 2 - 1...');
  const mockPrediction = {
    user_id: testUser.id,
    match_id: TEST_MATCH_ID,
    predicted_home_score: 2,
    predicted_away_score: 1,
  };

  const { error: predError } = await supabase.from('predictions').insert(mockPrediction);
  if (predError) {
    console.error('❌ Failed to insert mock prediction:', predError.message);
    await cleanupDb();
    process.exit(1);
  }

  let suitePassed = true;

  // Test Scenario 1: Exact Match (Predicted 2-1, Actual 2-1) -> Should award 3 points
  console.log('\n🔍 Test 1: Settle match as 2-1 (Exact Match)...');
  try {
    await settleMatch(TEST_MATCH_ID, 2, 1);
    
    // Check points awarded
    const { data: pData } = await supabase
      .from('predictions')
      .select('points_awarded')
      .eq('user_id', testUser.id)
      .eq('match_id', TEST_MATCH_ID)
      .single();

    // Check user points
    const { data: uData } = await supabase
      .from('users')
      .select('total_points')
      .eq('id', testUser.id)
      .single();

    if (pData?.points_awarded === 3) {
      console.log(`🟢 Test 1: PASS (Prediction awarded: ${pData.points_awarded} PTS, User total: ${uData?.total_points} PTS)`);
    } else {
      console.log(`🔴 Test 1: FAIL (Expected 3 points, got ${pData?.points_awarded})`);
      suitePassed = false;
    }
  } catch (err: any) {
    console.log(`🔴 Test 1: FAIL (Threw error: ${err.message})`);
    suitePassed = false;
  }

  // Test Scenario 2: Correct Outcome Only (Predicted 2-1, Actual 1-0) -> Should award 1 point
  console.log('\n🔍 Test 2: Settle match as 1-0 (Correct Outcome Only)...');
  try {
    await settleMatch(TEST_MATCH_ID, 1, 0);

    const { data: pData } = await supabase
      .from('predictions')
      .select('points_awarded')
      .eq('user_id', testUser.id)
      .eq('match_id', TEST_MATCH_ID)
      .single();

    const { data: uData } = await supabase
      .from('users')
      .select('total_points')
      .eq('id', testUser.id)
      .single();

    if (pData?.points_awarded === 1) {
      console.log(`🟢 Test 2: PASS (Prediction awarded: ${pData.points_awarded} PTS, User total: ${uData?.total_points} PTS)`);
    } else {
      console.log(`🔴 Test 2: FAIL (Expected 1 point, got ${pData?.points_awarded})`);
      suitePassed = false;
    }
  } catch (err: any) {
    console.log(`🔴 Test 2: FAIL (Threw error: ${err.message})`);
    suitePassed = false;
  }

  // Test Scenario 3: Incorrect Outcome (Predicted 2-1, Actual 1-2) -> Should award 0 points
  console.log('\n🔍 Test 3: Settle match as 1-2 (Incorrect Outcome)...');
  try {
    await settleMatch(TEST_MATCH_ID, 1, 2);

    const { data: pData } = await supabase
      .from('predictions')
      .select('points_awarded')
      .eq('user_id', testUser.id)
      .eq('match_id', TEST_MATCH_ID)
      .single();

    const { data: uData } = await supabase
      .from('users')
      .select('total_points')
      .eq('id', testUser.id)
      .single();

    if (pData?.points_awarded === 0) {
      console.log(`🟢 Test 3: PASS (Prediction awarded: ${pData.points_awarded} PTS, User total: ${uData?.total_points} PTS)`);
    } else {
      console.log(`🔴 Test 3: FAIL (Expected 0 points, got ${pData?.points_awarded})`);
      suitePassed = false;
    }
  } catch (err: any) {
    console.log(`🔴 Test 3: FAIL (Threw error: ${err.message})`);
    suitePassed = false;
  }

  // E. Cleanup
  console.log('\n🧹 Cleaning up test database records...');
  await cleanupDb();
  
  // Restore initial points for test user to clean up side effects
  await supabase
    .from('users')
    .update({ total_points: testUser.total_points })
    .eq('id', testUser.id);
  console.log('✨ Cleanup finished.');

  console.log('--------------------------------------------------');
  if (suitePassed) {
    console.log('🏆 DIAGNOSTICS COMPLETE: ALL SETTLEMENT TESTS PASSED!');
  } else {
    console.log('❌ DIAGNOSTICS COMPLETE: SOME SETTLEMENT TESTS FAILED.');
  }
  console.log('--------------------------------------------------');
}

async function cleanupDb() {
  await supabase.from('matches').delete().eq('id', TEST_MATCH_ID);
}

runSettlementTest().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
