/**
 * Comprehensive Test Suite for Supabase Database Engine in NamoGPT
 * 
 * Verifies:
 * 1. Supabase client setup & schema mappings (snake_case <-> camelCase)
 * 2. Supabase PostgREST Query Builder calls:
 *    - from('users').select().or().maybeSingle()
 *    - from('users').insert().select().single()
 *    - from('users').update().eq().select().maybeSingle()
 *    - from('users').select().order()
 *    - from('chats').upsert().select().single()
 *    - from('chats').select().eq().order()
 *    - from('chats').select().eq().maybeSingle()
 *    - from('chats').update().eq().select().maybeSingle()
 *    - from('chats').delete().eq()
 * 3. Fallback resiliency when Supabase is unconfigured / offline
 * 4. Auth & Chat persistence operations
 */

import db, {
  setSupabaseClient,
  isUsingSupabase,
  getDatabaseProvider,
  toUserRecord,
  toChatRecord
} from './db.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('⚡ NAMOGPT SUPABASE DATABASE ENGINE VERIFICATION TEST SUITE');
  console.log('======================================================================\n');

  // [SUITE 1] Schema Field Mapping (snake_case <-> camelCase)
  console.log('[SUITE 1] Schema Field Mapping & Transformation');
  const userRow = {
    id: 'user-supa-101',
    name: 'Supabase Tester',
    email: 'supa_test@namogpt.com',
    dob: '1995-10-25',
    username: 'supa_tester_99',
    password_hash: 'salt_123:hash_456',
    role: 'user',
    created_at: '2026-10-12T18:00:00.000Z',
    last_login_at: '2026-10-12T18:05:00.000Z'
  };
  const userRec = toUserRecord(userRow);
  assert(userRec.id === 'user-supa-101', 'User ID mapped correctly');
  assert(userRec.passwordHash === 'salt_123:hash_456', 'password_hash mapped to passwordHash');
  assert(userRec.lastLoginAt === '2026-10-12T18:05:00.000Z', 'last_login_at mapped to lastLoginAt');
  assert(userRec.createdAt === '2026-10-12T18:00:00.000Z', 'created_at mapped to createdAt');

  const chatRow = {
    id: 'chat-supa-202',
    user_id: 'user-supa-101',
    title: 'Supabase Chat Session',
    model: 'auto',
    messages: [{ role: 'user', content: 'Hello Supabase!' }],
    is_pinned: true,
    created_at: '2026-10-12T18:00:00.000Z',
    updated_at: '2026-10-12T18:10:00.000Z'
  };
  const chatRec = toChatRecord(chatRow);
  assert(chatRec.userId === 'user-supa-101', 'user_id mapped to userId');
  assert(chatRec.isPinned === true, 'is_pinned mapped to isPinned');
  assert(chatRec.messages.length === 1, 'messages JSON array preserved');

  // [SUITE 2] Supabase Client Query Engine Simulation
  console.log('\n[SUITE 2] Supabase PostgREST Query Execution Simulation');
  
  // Create an in-memory mock Supabase table simulator matching the PostgREST API
  const inMemoryDb = {
    users: [],
    chats: []
  };

  const mockSupabase = {
    from(tableName) {
      const state = {
        table: tableName,
        selectedFields: null,
        filters: [],
        sort: null,
        limitVal: null,
        singleVal: false,
        maybeSingleVal: false,
        action: 'select',
        actionData: null
      };

      const builder = {
        select(fields) {
          state.selectedFields = fields;
          return builder;
        },
        insert(data) {
          state.action = 'insert';
          state.actionData = data;
          return builder;
        },
        update(data) {
          state.action = 'update';
          state.actionData = data;
          return builder;
        },
        upsert(data) {
          state.action = 'upsert';
          state.actionData = data;
          return builder;
        },
        delete() {
          state.action = 'delete';
          return builder;
        },
        eq(col, val) {
          state.filters.push({ type: 'eq', col, val });
          return builder;
        },
        or(clause) {
          state.filters.push({ type: 'or', clause });
          return builder;
        },
        order(col, options = {}) {
          state.sort = { col, ascending: options.ascending !== false };
          return builder;
        },
        limit(n) {
          state.limitVal = n;
          return builder;
        },
        single() {
          state.singleVal = true;
          return builder.then();
        },
        maybeSingle() {
          state.maybeSingleVal = true;
          return builder.then();
        },
        async then(resolve) {
          const records = inMemoryDb[state.table] || [];
          let resultData = null;
          let resultError = null;

          if (state.action === 'insert') {
            const row = { ...state.actionData };
            records.push(row);
            resultData = row;
          } else if (state.action === 'upsert') {
            const row = { ...state.actionData };
            const existingIdx = records.findIndex(r => r.id === row.id);
            if (existingIdx !== -1) {
              records[existingIdx] = { ...records[existingIdx], ...row };
              resultData = records[existingIdx];
            } else {
              records.push(row);
              resultData = row;
            }
          } else if (state.action === 'update') {
            let updatedRow = null;
            for (let i = 0; i < records.length; i++) {
              let match = true;
              for (const f of state.filters) {
                if (f.type === 'eq' && records[i][f.col] !== f.val) match = false;
              }
              if (match) {
                records[i] = { ...records[i], ...state.actionData };
                updatedRow = records[i];
                break;
              }
            }
            resultData = updatedRow;
          } else if (state.action === 'delete') {
            const beforeCount = records.length;
            const remaining = records.filter(r => {
              for (const f of state.filters) {
                if (f.type === 'eq' && r[f.col] === f.val) return false;
              }
              return true;
            });
            inMemoryDb[state.table] = remaining;
            resultData = { count: beforeCount - remaining.length };
          } else if (state.action === 'select') {
            let matched = [...records];
            for (const f of state.filters) {
              if (f.type === 'eq') {
                matched = matched.filter(r => r[f.col] === f.val);
              } else if (f.type === 'or') {
                // e.g. email.ilike.val,username.ilike.val
                const parts = f.clause.split(',');
                matched = matched.filter(r => {
                  return parts.some(p => {
                    const [col, op, ...valParts] = p.split('.');
                    const val = valParts.join('.');
                    if (r[col]) {
                      return r[col].toLowerCase() === (val || '').toLowerCase();
                    }
                    return false;
                  });
                });
              }
            }

            if (state.sort) {
              const { col, ascending } = state.sort;
              matched.sort((a, b) => {
                if (a[col] < b[col]) return ascending ? -1 : 1;
                if (a[col] > b[col]) return ascending ? 1 : -1;
                return 0;
              });
            }

            if (state.limitVal) {
              matched = matched.slice(0, state.limitVal);
            }

            if (state.singleVal || state.maybeSingleVal) {
              resultData = matched[0] || null;
            } else {
              resultData = matched;
            }
          }

          const res = { data: resultData, error: resultError };
          if (resolve) return resolve(res);
          return res;
        }
      };

      return builder;
    }
  };

  // Configure Supabase client in db service
  setSupabaseClient(mockSupabase);
  assert(isUsingSupabase() === true, 'isUsingSupabase() returns true when client is configured');
  assert(getDatabaseProvider() === 'supabase', 'getDatabaseProvider() returns "supabase"');

  // [SUITE 3] User Operations on Supabase
  console.log('\n[SUITE 3] Supabase User Management Verification');
  const testUser = await db.createUser({
    name: 'Devin Supa',
    email: 'devin@supabase.test',
    dob: '1992-08-18',
    username: 'devin_supa_99',
    passwordHash: 'salt_dev:hash_dev',
    role: 'user'
  });

  assert(testUser.id !== undefined, 'User created in Supabase with ID');
  assert(testUser.email === 'devin@supabase.test', 'User email stored');
  assert(testUser.username === 'devin_supa_99', 'User username stored');

  // Lookup by email
  const foundByEmail = await db.findUserByEmailOrUsername('devin@supabase.test');
  assert(foundByEmail !== null, 'Found user by email in Supabase');
  assert(foundByEmail.id === testUser.id, 'User ID matches from email search');

  // Lookup by username
  const foundByUsername = await db.findUserByEmailOrUsername('devin_supa_99');
  assert(foundByUsername !== null, 'Found user by username in Supabase');
  assert(foundByUsername.name === 'Devin Supa', 'User name matches from username search');

  // Update user
  const updatedUser = await db.updateUser(testUser.id, {
    name: 'Devin Supa (Updated)',
    lastLoginAt: new Date().toISOString()
  });
  assert(updatedUser.name === 'Devin Supa (Updated)', 'Updated user name in Supabase');

  // Get all users
  const allUsers = await db.getAllUsers();
  assert(allUsers.length >= 1, 'getAllUsers returns array with created user');

  // [SUITE 4] Chat Operations on Supabase
  console.log('\n[SUITE 4] Supabase Chat Persistence Verification');
  const testChat = await db.saveChat({
    id: 'chat-supa-test-01',
    userId: testUser.id,
    title: 'Supabase Initial Chat',
    model: 'auto',
    messages: [
      { id: 'm1', role: 'user', content: 'What is Supabase?' },
      { id: 'm2', role: 'assistant', content: 'Supabase is an open source Firebase alternative built on Postgres.' }
    ]
  });

  assert(testChat.id === 'chat-supa-test-01', 'Chat saved in Supabase with correct ID');
  assert(testChat.messages.length === 2, 'Chat has 2 initial messages');

  // Fetch chats for user
  const userChats = await db.findChatsByUserId(testUser.id);
  assert(userChats.length >= 1, 'findChatsByUserId returned chat from Supabase');
  assert(userChats[0].id === 'chat-supa-test-01', 'First chat ID matches');

  // Fetch by chat ID
  const chatById = await db.getChatById('chat-supa-test-01');
  assert(chatById !== null, 'getChatById returned chat from Supabase');
  assert(chatById.title === 'Supabase Initial Chat', 'Chat title verified');

  // Rename chat
  const renamedChat = await db.updateChatTitle('chat-supa-test-01', 'Supabase Renamed Guide');
  assert(renamedChat.title === 'Supabase Renamed Guide', 'Chat title updated in Supabase');

  // Delete chat
  const deleteResult = await db.deleteChat('chat-supa-test-01');
  assert(deleteResult === true, 'deleteChat returned true');
  const chatAfterDelete = await db.getChatById('chat-supa-test-01');
  assert(chatAfterDelete === null, 'Chat was removed from Supabase');

  // [SUITE 5] Fallback Resiliency Verification
  console.log('\n[SUITE 5] Local Fallback Storage Resiliency Verification');
  // Disconnect Supabase to test offline / unconfigured fallback
  setSupabaseClient(null);
  assert(isUsingSupabase() === false, 'isUsingSupabase() returns false when client unset');
  assert(getDatabaseProvider() === 'local-json', 'getDatabaseProvider() falls back to "local-json"');

  const fallbackUser = await db.createUser({
    name: 'Fallback User',
    email: 'fallback@test.local',
    dob: '2000-01-01',
    username: 'fallback_usr_1',
    passwordHash: 'salt_fb:hash_fb'
  });
  assert(fallbackUser.id !== undefined, 'Fallback user created in local storage');

  const foundFallback = await db.findUserByEmailOrUsername('fallback@test.local');
  assert(foundFallback !== null, 'Found fallback user by email in local storage');

  console.log('\n======================================================================');
  console.log(`🎉 ALL SUPABASE TESTS PASSED! (${passedCount} passed, ${failedCount} failed)`);
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
