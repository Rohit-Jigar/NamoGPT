/**
 * Comprehensive Test Suite for NamoGPT Chat Persistence, Multi-Turn Memory, and Unrestricted Access
 * 
 * Verifies:
 * 1. REST Endpoints:
 *    - POST /api/chats (saving prompt and response)
 *    - GET /api/chats (fetching user/guest chats)
 *    - GET /api/chats/:id (fetching by ID)
 *    - PUT /api/chats/:id/title (renaming a chat)
 *    - DELETE /api/chats/:id (deleting a chat)
 * 2. Multi-turn Conversational Memory:
 *    - Chronological user and assistant turn preservation
 *    - Consecutive prompts retain full context memory (passcode recall)
 *    - Clean structure across system prompt, search context, history turns, and current turn
 * 3. Super Admin Restrictions Removal:
 *    - Unrestricted access to /api/admin/status and /api/auth/users
 */

import http from 'http';
import axios from 'axios';
import { app } from './server.js';
import db from './db.js';
import { structureChatMessages, NAMOGPT_IDENTITY_PROMPT } from './api/index.js';
import { registerUser, createToken } from './auth.js';

const TEST_PORT = 3088;
const BASE_URL = `http://localhost:${TEST_PORT}`;

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
  console.log('🧪 NAMOGPT CHAT STORAGE & CONTEXT MEMORY ARCHITECT TEST SUITE');
  console.log('======================================================================\n');

  // Start dedicated test server
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      console.log(`🚀 Test server listening on ${BASE_URL}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------------------
    // SUITE 1: Direct DB Layer Verification
    // -------------------------------------------------------------------------
    console.log('[SUITE 1] Direct DB Layer Persistence Verification');
    await db.initDb();
    assert(typeof db.saveChat === 'function', 'db.saveChat function exists');
    assert(typeof db.getChats === 'function', 'db.getChats function exists');
    assert(typeof db.getChatById === 'function', 'db.getChatById function exists');
    assert(typeof db.deleteChat === 'function', 'db.deleteChat function exists');
    assert(typeof db.updateChatTitle === 'function', 'db.updateChatTitle function exists');

    // -------------------------------------------------------------------------
    // SUITE 2: REST Chat Endpoints (POST, GET, PUT, DELETE)
    // -------------------------------------------------------------------------
    console.log('\n[SUITE 2] REST Chat Persistence Endpoints Verification');

    const testChatId = `chat-test-${Date.now()}`;
    const initialMessages = [
      {
        id: `msg-user-1`,
        role: 'user',
        content: 'Explain quantum superposition in one sentence.',
        createdAt: Date.now() - 5000
      },
      {
        id: `msg-asst-1`,
        role: 'assistant',
        content: 'Quantum superposition allows a physical system to exist in multiple states simultaneously until observed.',
        createdAt: Date.now() - 2000
      }
    ];

    // 1. POST /api/chats - Create Chat with prompt & response
    console.log('--- 1. Testing POST /api/chats (Create Chat Session) ---');
    const postRes = await axios.post(`${BASE_URL}/api/chats`, {
      id: testChatId,
      userId: 'test-user-worker2',
      title: 'Quantum Physics Inquiry',
      model: 'groq',
      messages: initialMessages,
      isPinned: false
    });

    assert(postRes.status === 200, 'POST /api/chats returns HTTP 200');
    assert(postRes.data.success === true, 'POST /api/chats response success is true');
    assert(postRes.data.chat.id === testChatId, `Chat ID matches (${testChatId})`);
    assert(postRes.data.chat.title === 'Quantum Physics Inquiry', 'Chat title matches');
    assert(postRes.data.chat.messages.length === 2, 'Chat has 2 initial messages');

    // 2. GET /api/chats - List all chats for user
    console.log('\n--- 2. Testing GET /api/chats (List User Chats) ---');
    const getChatsRes = await axios.get(`${BASE_URL}/api/chats?userId=test-user-worker2`);
    assert(getChatsRes.status === 200, 'GET /api/chats returns HTTP 200');
    assert(getChatsRes.data.success === true, 'GET /api/chats response success is true');
    assert(Array.isArray(getChatsRes.data.chats), 'Chats returned as array');
    const foundChatInList = getChatsRes.data.chats.find(c => c.id === testChatId);
    assert(Boolean(foundChatInList), 'Created chat is present in GET /api/chats listing');

    // 3. GET /api/chats/:id - Retrieve chat by ID
    console.log('\n--- 3. Testing GET /api/chats/:id (Get Chat by ID) ---');
    const getByIdRes = await axios.get(`${BASE_URL}/api/chats/${testChatId}`);
    assert(getByIdRes.status === 200, 'GET /api/chats/:id returns HTTP 200');
    assert(getByIdRes.data.success === true, 'GET /api/chats/:id response success is true');
    assert(getByIdRes.data.chat.id === testChatId, 'Returned chat ID matches');
    assert(getByIdRes.data.chat.messages.length === 2, 'Returned chat contains stored prompt and response');

    // 4. PUT /api/chats/:id/title - Rename chat title
    console.log('\n--- 4. Testing PUT /api/chats/:id/title (Rename Chat) ---');
    const renameRes = await axios.put(`${BASE_URL}/api/chats/${testChatId}/title`, {
      title: 'Advanced Quantum Mechanics'
    });
    assert(renameRes.status === 200, 'PUT /api/chats/:id/title returns HTTP 200');
    assert(renameRes.data.success === true, 'PUT /api/chats/:id/title response success is true');
    assert(renameRes.data.title === 'Advanced Quantum Mechanics', 'Renamed title matches');

    // Verify title in DB
    const verifiedChat = await db.getChatById(testChatId);
    assert(verifiedChat.title === 'Advanced Quantum Mechanics', 'Database reflects renamed title');

    // -------------------------------------------------------------------------
    // SUITE 3: Multi-Turn Context Memory & Consecutive Prompts
    // -------------------------------------------------------------------------
    console.log('\n[SUITE 3] Multi-Turn Conversational Memory & Consecutive Prompts');

    // Test structureChatMessages cleanly prepares prompt structure
    const rawHistory = [
      { role: 'system', content: 'Custom persona instruction.' },
      { role: 'user', content: 'Turn 1 user' },
      { role: 'assistant', content: 'Turn 1 assistant' },
      { role: 'system', content: 'Another instruction.' },
      { role: 'user', content: 'Turn 2 user' }
    ];
    const structured = structureChatMessages(rawHistory);
    assert(structured[0].role === 'system', 'Index 0 is single consolidated system message');
    assert(structured[0].content.includes('NamoGPT'), 'System message contains NamoGPT identity');
    assert(structured[0].content.includes('Custom persona instruction'), 'System message contains custom instruction');
    assert(structured[1].role === 'user' && structured[1].content === 'Turn 1 user', 'Turn 1 user preserved chronologically');
    assert(structured[2].role === 'assistant' && structured[2].content === 'Turn 1 assistant', 'Turn 1 assistant preserved chronologically');
    assert(structured[3].role === 'user' && structured[3].content === 'Turn 2 user', 'Turn 2 user preserved chronologically');
    assert(structured.length === 4, 'Structured messages has exactly 1 system + 3 conversation turns');

    // Multi-turn live test across consecutive prompts
    console.log(`\n--- Consecutive Prompt Turn 1: Providing Context (emerald green & Barnaby) ---`);

    const turn1Payload = {
      model: 'auto',
      messages: [
        { role: 'user', content: 'My favorite color is emerald green and my pet dog is named Barnaby. Please acknowledge this.' }
      ]
    };

    const turn1Res = await axios.post(`${BASE_URL}/v1/chat/completions`, turn1Payload);
    assert(turn1Res.status === 200, 'Turn 1 returns HTTP 200');
    const turn1AssistantContent = turn1Res.data.choices?.[0]?.message?.content || '';
    assert(turn1AssistantContent.length > 0, 'Turn 1 assistant returned non-empty completion');
    console.log(`  Turn 1 Response: "${turn1AssistantContent.trim().slice(0, 100)}..."`);

    // Save Turn 1 to DB chat
    const updatedMessagesWithTurn1 = [
      ...initialMessages,
      { id: `msg-user-turn1`, role: 'user', content: turn1Payload.messages[0].content, createdAt: Date.now() - 1000 },
      { id: `msg-asst-turn1`, role: 'assistant', content: turn1AssistantContent, createdAt: Date.now() }
    ];
    await axios.post(`${BASE_URL}/api/chats`, {
      id: testChatId,
      userId: 'test-user-worker2',
      messages: updatedMessagesWithTurn1,
      updatedAt: Date.now()
    });

    console.log(`\n--- Consecutive Prompt Turn 2: Querying Context Memory for Details ---`);
    // Full multi-turn chronological context provided to model just like ChatGPT
    const turn2Payload = {
      model: 'auto',
      messages: [
        { role: 'user', content: 'My favorite color is emerald green and my pet dog is named Barnaby. Please acknowledge this.' },
        { role: 'assistant', content: turn1AssistantContent },
        { role: 'user', content: "What is my favorite color and what is my pet dog's name?" }
      ]
    };

    const turn2Res = await axios.post(`${BASE_URL}/v1/chat/completions`, turn2Payload);
    assert(turn2Res.status === 200, 'Turn 2 returns HTTP 200');
    const turn2AssistantContent = turn2Res.data.choices?.[0]?.message?.content || '';
    assert(turn2AssistantContent.length > 0, 'Turn 2 assistant returned non-empty completion');
    console.log(`  Turn 2 Response: "${turn2AssistantContent.trim()}"`);

    // Verify model preserved context of previous turns
    const recalledColor = turn2AssistantContent.toLowerCase().includes('emerald green');
    const recalledDog = turn2AssistantContent.toLowerCase().includes('barnaby');
    assert(recalledColor, 'Model recalled favorite color "emerald green" from previous conversational turn');
    assert(recalledDog, 'Model recalled pet dog\'s name "Barnaby" from previous conversational turn');

    // Save Turn 2 to DB chat
    const finalMessages = [
      ...updatedMessagesWithTurn1,
      { id: `msg-user-turn2`, role: 'user', content: turn2Payload.messages[2].content, createdAt: Date.now() - 500 },
      { id: `msg-asst-turn2`, role: 'assistant', content: turn2AssistantContent, createdAt: Date.now() }
    ];
    await axios.post(`${BASE_URL}/api/chats`, {
      id: testChatId,
      userId: 'test-user-worker2',
      messages: finalMessages,
      updatedAt: Date.now()
    });

    const finalStoredChat = await db.getChatById(testChatId);
    assert(finalStoredChat.messages.length === 6, 'Chat in DB contains all 6 consecutive turns preserved in order');

    // -------------------------------------------------------------------------
    // SUITE 4: Delete Chat Endpoint
    // -------------------------------------------------------------------------
    console.log('\n[SUITE 4] DELETE /api/chats/:id Endpoint Verification');
    const deleteRes = await axios.delete(`${BASE_URL}/api/chats/${testChatId}`);
    assert(deleteRes.status === 200, 'DELETE /api/chats/:id returns HTTP 200');
    assert(deleteRes.data.success === true, 'DELETE /api/chats/:id response success is true');

    // Verify chat no longer exists via API
    try {
      await axios.get(`${BASE_URL}/api/chats/${testChatId}`);
      assert(false, 'GET /api/chats/:id should return 404 after deletion');
    } catch (err) {
      assert(err.response?.status === 404, 'GET /api/chats/:id returns 404 for deleted chat');
    }

    // Verify deletion in DB
    const deletedDbChat = await db.getChatById(testChatId);
    assert(deletedDbChat === null, 'Chat is removed from database storage');

    // -------------------------------------------------------------------------
    // SUITE 5: Super Admin Restrictions Removal Verification
    // -------------------------------------------------------------------------
    console.log('\n[SUITE 5] Super Admin Restrictions Removal Verification');

    // 1. /api/admin/status without token (unrestricted local access)
    console.log('--- 1. Testing /api/admin/status (Unrestricted Access) ---');
    const adminStatusRes = await axios.get(`${BASE_URL}/api/admin/status`);
    assert(adminStatusRes.status === 200, 'GET /api/admin/status returns HTTP 200 without admin credentials');
    assert(adminStatusRes.data.success === true, 'GET /api/admin/status returns success: true');
    assert(Boolean(adminStatusRes.data.server), 'Server telemetry is accessible');
    assert(Boolean(adminStatusRes.data.keysDetected), 'Keys detected status is accessible');

    // 2. /api/auth/users with standard non-admin user
    console.log('\n--- 2. Testing /api/auth/users (Standard User Access) ---');
    const regularUserToken = createToken({
      id: 'regular-user-worker2',
      email: 'regular@worker2.test',
      name: 'Regular Test User',
      role: 'user' // Standard user role (NOT admin, NOT superadmin)
    });

    const usersRes = await axios.get(`${BASE_URL}/api/auth/users`, {
      headers: { Authorization: `Bearer ${regularUserToken}` }
    });
    assert(usersRes.status === 200, 'GET /api/auth/users returns HTTP 200 for standard role: "user"');
    assert(usersRes.data.success === true, 'GET /api/auth/users returns success: true');
    assert(Array.isArray(usersRes.data.users), 'Users array is accessible to all authenticated users');

    // 3. /api/auth/users without token (unrestricted local session)
    const localUsersRes = await axios.get(`${BASE_URL}/api/auth/users`);
    assert(localUsersRes.status === 200, 'GET /api/auth/users returns HTTP 200 for unauthenticated local sessions');
    assert(localUsersRes.data.success === true, 'User catalog is completely unlocked');

    console.log('\n======================================================================');
    console.log(`🎉 ALL ASSERTIONS PASSED! (${passedCount} passed, ${failedCount} failed)`);
    console.log('======================================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
