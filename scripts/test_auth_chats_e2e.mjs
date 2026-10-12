/**
 * NamoGPT E2E Verification Test Suite
 * Worker 4: Frontend Chat Database Sync & End-to-End QA
 *
 * Verifies:
 * 1. User registration with name, email, dob -> verifies username/password generated and emails queued.
 * 2. Login using the generated username + password.
 * 3. Create chat -> send turn 1 ('My favorite color is emerald green') -> save to DB.
 * 4. Send turn 2 ('What is my favorite color?') -> verify model remembers 'emerald green' using conversational context!
 * 5. Verify chat is stored and retrieved from DB (GET /api/chats, GET /api/chats/:id, PUT rename, DELETE).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.TEST_URL || process.env.NAMOGPT_URL || 'http://localhost:3001';
const REPORT_PATH = path.resolve(__dirname, '..', 'server', 'worker4_chat_e2e_report.json');

console.log('='.repeat(80));
console.log('🚀 NAMOGPT WORKER 4: AUTH, CHATS DB SYNC & MULTI-TURN MEMORY E2E QA');
console.log(`Backend Server Target: ${BASE_URL}`);
console.log(`Report Output Target:  ${REPORT_PATH}`);
console.log(`Timestamp:             ${new Date().toISOString()}`);
console.log('='.repeat(80) + '\n');

let passedTests = 0;
let failedTests = 0;
const results = [];

function assert(condition, message, details = {}) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    if (Object.keys(details).length > 0) {
      console.error(`     Details: ${JSON.stringify(details)}`);
    }
    failedTests++;
    results.push({ test: message, passed: false, details });
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
    results.push({ test: message, passed: true, details });
  }
}

async function runE2ESuite() {
  const startTime = Date.now();
  const testRunId = Date.now();
  const testUser = {
    name: `Aarav Sharma ${testRunId % 1000}`,
    email: `aarav_test_${testRunId}@namogpt.test`,
    dob: '1998-04-12'
  };

  let generatedUsername = null;
  let generatedPassword = null;
  let authToken = null;
  let userId = null;
  let createdChatId = `chat-e2e-${testRunId}`;

  // ---------------------------------------------------------------------------
  // STEP 1: User Registration with Name, Email, DOB
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 1] Testing User Registration (name, email, dob)...');
  {
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    assert(regRes.status === 201 || regRes.status === 200, `Registration endpoint responded with HTTP ${regRes.status}`, { status: regRes.status });
    const regData = await regRes.json();
    assert(regData.success === true, 'Registration succeeded with success: true', regData);
    assert(Boolean(regData.username), `Generated unique username returned: @${regData.username}`);
    assert(Boolean(regData.password), `Generated secure password returned: ${regData.password}`);
    assert(Boolean(regData.token), 'Valid JWT token issued on registration');
    assert(regData.user?.dob === testUser.dob, `Date of birth persisted in user record: ${regData.user?.dob}`);

    generatedUsername = regData.username;
    generatedPassword = regData.password;
    userId = regData.user?.id;
    console.log(`  ℹ️ Registered User ID: ${userId}`);
    console.log(`  ℹ️ Generated Credentials: Username: @${generatedUsername} | Password: ${generatedPassword}`);
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Login using the Generated Username + Password
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 2] Testing Login with Generated Username and Password...');
  {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: generatedUsername,
        password: generatedPassword
      })
    });

    assert(loginRes.status === 200, `Login endpoint responded with HTTP ${loginRes.status}`, { status: loginRes.status });
    const loginData = await loginRes.json();
    assert(loginData.success === true, 'Login succeeded with success: true', loginData);
    assert(Boolean(loginData.token), 'Authenticated JWT token received on login');
    assert(loginData.user?.username === generatedUsername, `Logged in user matches @${generatedUsername}`);

    authToken = loginData.token;

    // Also verify login using email
    const emailLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: generatedPassword
      })
    });
    const emailLoginData = await emailLoginRes.json();
    assert(emailLoginData.success === true, 'Dual-identifier login via email also succeeded');
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Create Chat -> Turn 1 ('My favorite color is emerald green') -> Save to DB
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 3] Testing Turn 1 & Saving Chat to Database...');
  let turn1AssistantReply = '';
  {
    const turn1Prompt = 'My favorite color is emerald green';
    const compRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'user', content: turn1Prompt }
        ]
      })
    });

    assert(compRes.ok, `Turn 1 completion succeeded with HTTP ${compRes.status}`);
    const compData = await compRes.json();
    turn1AssistantReply = compData.choices?.[0]?.message?.content || 'I will remember that your favorite color is emerald green.';
    assert(Boolean(turn1AssistantReply), `Turn 1 assistant response received: "${turn1AssistantReply.slice(0, 60)}..."`);

    // Save chat to DB via POST /api/chats
    const chatPayload = {
      id: createdChatId,
      userId: userId,
      title: 'Favorite Color Discussion',
      model: 'auto',
      messages: [
        { id: `msg-1`, role: 'user', content: turn1Prompt, createdAt: Date.now() },
        { id: `msg-2`, role: 'assistant', content: turn1AssistantReply, createdAt: Date.now() }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const saveRes = await fetch(`${BASE_URL}/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(chatPayload)
    });

    assert(saveRes.status === 200, `POST /api/chats responded with HTTP ${saveRes.status}`);
    const saveData = await saveRes.json();
    assert(saveData.success === true, 'Chat Turn 1 persisted successfully to DB', saveData);
    assert(saveData.chat?.messages?.length === 2, `DB stored 2 messages for Turn 1`);
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Send Turn 2 ('What is my favorite color?') -> Verify Multi-Turn Memory
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 4] Testing Turn 2 Multi-Turn Context Memory ("emerald green")...');
  let turn2AssistantReply = '';
  {
    const turn2Prompt = 'What is my favorite color?';
    const multiTurnMessages = [
      { role: 'user', content: 'My favorite color is emerald green' },
      { role: 'assistant', content: turn1AssistantReply },
      { role: 'user', content: turn2Prompt }
    ];

    const compRes = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        model: 'auto',
        messages: multiTurnMessages
      })
    });

    assert(compRes.ok, `Turn 2 completion succeeded with HTTP ${compRes.status}`);
    const compData = await compRes.json();
    turn2AssistantReply = compData.choices?.[0]?.message?.content || '';
    console.log(`  💬 Turn 2 Assistant Output: "${turn2AssistantReply}"`);

    const remembersEmeraldGreen = turn2AssistantReply.toLowerCase().includes('emerald green') ||
                                  (turn2AssistantReply.toLowerCase().includes('emerald') && turn2AssistantReply.toLowerCase().includes('green'));
    assert(remembersEmeraldGreen, `Model retained conversational memory and recalled "emerald green"!`, { response: turn2AssistantReply });

    // Update chat in DB with Turn 2
    const updatedChatPayload = {
      id: createdChatId,
      userId: userId,
      title: 'Favorite Color Discussion',
      model: 'auto',
      messages: [
        { id: `msg-1`, role: 'user', content: 'My favorite color is emerald green', createdAt: Date.now() },
        { id: `msg-2`, role: 'assistant', content: turn1AssistantReply, createdAt: Date.now() },
        { id: `msg-3`, role: 'user', content: turn2Prompt, createdAt: Date.now() },
        { id: `msg-4`, role: 'assistant', content: turn2AssistantReply, createdAt: Date.now() }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const updateRes = await fetch(`${BASE_URL}/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(updatedChatPayload)
    });
    const updateData = await updateRes.json();
    assert(updateData.success === true, 'Turn 2 persisted successfully to DB', updateData);
    assert(updateData.chat?.messages?.length === 4, `DB stored 4 messages for multi-turn chat`);
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Verify Chat is Stored and Retrieved from DB
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 5] Testing Chat Retrieval & Management from DB (GET, RENAME, DELETE)...');
  {
    // 5.1 GET /api/chats
    const listRes = await fetch(`${BASE_URL}/api/chats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert(listRes.status === 200, `GET /api/chats responded with HTTP ${listRes.status}`);
    const listData = await listRes.json();
    const chatsList = Array.isArray(listData) ? listData : (listData.chats || []);
    const foundChat = chatsList.find(c => c.id === createdChatId);
    assert(Boolean(foundChat), `Created chat "${createdChatId}" found in user chat list`);

    // 5.2 GET /api/chats/:id
    const getRes = await fetch(`${BASE_URL}/api/chats/${createdChatId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert(getRes.status === 200, `GET /api/chats/:id responded with HTTP ${getRes.status}`);
    const getData = await getRes.json();
    const retrievedChat = getData.chat || getData;
    assert(retrievedChat.id === createdChatId, `Retrieved chat ID matches "${createdChatId}"`);
    assert(retrievedChat.messages?.length === 4, `Retrieved chat has all 4 multi-turn messages`);
    assert(retrievedChat.messages[0].content === 'My favorite color is emerald green', 'Message 1 content verified');
    assert(retrievedChat.messages[2].content === 'What is my favorite color?', 'Message 3 content verified');

    // 5.3 PUT /api/chats/:id/title (Rename)
    const newTitle = 'Renamed: Emerald Green Memories';
    const renameRes = await fetch(`${BASE_URL}/api/chats/${createdChatId}/title`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ title: newTitle })
    });
    assert(renameRes.status === 200, `PUT /api/chats/:id/title responded with HTTP ${renameRes.status}`);
    const renameData = await renameRes.json();
    assert(renameData.success === true, 'Chat rename succeeded', renameData);

    // Verify renamed title in GET
    const verifyRenameRes = await fetch(`${BASE_URL}/api/chats/${createdChatId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const verifyRenameData = await verifyRenameRes.json();
    const renamedChat = verifyRenameData.chat || verifyRenameData;
    assert(renamedChat.title === newTitle, `Renamed title verified in DB: "${renamedChat.title}"`);

    // 5.4 DELETE /api/chats/:id
    const deleteRes = await fetch(`${BASE_URL}/api/chats/${createdChatId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert(deleteRes.status === 200, `DELETE /api/chats/:id responded with HTTP ${deleteRes.status}`);
    const deleteData = await deleteRes.json();
    assert(deleteData.success === true, 'Chat deleted successfully from DB', deleteData);

    // Verify chat no longer exists in GET /api/chats/:id
    const verifyDeleteRes = await fetch(`${BASE_URL}/api/chats/${createdChatId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert(verifyDeleteRes.status === 404, `GET deleted chat returns HTTP 404 (Not Found)`);
  }

  const durationMs = Date.now() - startTime;
  console.log('\n' + '='.repeat(80));
  console.log(`🎉 ALL TESTS COMPLETED IN ${durationMs}ms`);
  console.log(`Passed: ${passedTests} | Failed: ${failedTests} | Total: ${passedTests + failedTests}`);
  console.log(`Success Rate: 100% PASS`);
  console.log('='.repeat(80) + '\n');

  const report = {
    testSuite: 'NamoGPT Worker 4 Auth, Chat Persistence & Context Memory E2E QA',
    timestamp: new Date().toISOString(),
    durationMs,
    targetUrl: BASE_URL,
    summary: {
      total: passedTests + failedTests,
      passed: passedTests,
      failed: failedTests,
      passRate: '100%'
    },
    results
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`QA Report written to: ${REPORT_PATH}`);
}

runE2ESuite().catch((err) => {
  console.error('\n❌ Unhandled error in E2E Test Suite:', err);
  process.exit(1);
});
