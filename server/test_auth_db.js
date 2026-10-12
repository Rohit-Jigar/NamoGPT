import {
  connectDB,
  isUsingMongo,
  findUserByEmailOrUsername,
  findUserById,
  getAllUsers,
  saveChat,
  findChatsByUserId,
  getChatById,
  deleteChat,
  UserModel,
  ChatModel
} from './db.js';

import {
  registerUser,
  loginUser,
  verifyToken,
  generateUniqueUsername,
  generateSecurePassword,
  SUPER_ADMIN_CREDENTIALS
} from './auth.js';

import { sendRegistrationEmails, getTransporter } from './mailer.js';

async function runTestAuthDbSuite() {
  console.log('\n===============================================================');
  console.log('   🚀 NAMOGPT DATABASE, AUTH & EMAIL ENGINE VERIFICATION TEST   ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Database Layer & Fallback Engine
    // -------------------------------------------------------------
    console.log('[TEST 1] Verifying Database Layer Initialization & Models...');
    await connectDB();
    const usingMongo = isUsingMongo();
    console.log(`  Engine mode: ${usingMongo ? '🍃 MongoDB Atlas (Connected)' : '📁 Local Resilient JSON Storage (Active)'}`);
    assert(Boolean(UserModel), 'UserModel is defined');
    assert(Boolean(ChatModel), 'ChatModel is defined');

    // -------------------------------------------------------------
    // TEST 2: Chat CRUD Helper Methods
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Verifying Chat CRUD DB Helpers...');
    const testUserId = `user-qa-${Date.now()}`;
    const testChatData = {
      userId: testUserId,
      title: 'QA Architecture Session',
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'Explain quantum routing.' },
        { role: 'assistant', content: 'Quantum routing optimizes pathways.' }
      ],
      isPinned: true
    };

    const savedChat = await saveChat(testChatData);
    assert(Boolean(savedChat && savedChat.id), `Chat saved successfully (ID: ${savedChat.id})`);

    const userChats = await findChatsByUserId(testUserId);
    assert(userChats.length >= 1, `findChatsByUserId returned ${userChats.length} chat(s)`);

    const fetchedChat = await getChatById(savedChat.id);
    assert(fetchedChat && fetchedChat.title === 'QA Architecture Session', 'getChatById returned matching chat');

    const deleted = await deleteChat(savedChat.id);
    assert(deleted === true, 'deleteChat successfully removed test chat');

    // -------------------------------------------------------------
    // TEST 3: User Registration with Auto-Generated Credentials & DOB
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Testing User Registration with Name, Email, and DOB...');
    const timestamp = Date.now();
    const testName = 'Rohit Maheshbhai';
    const testEmail = `rohit_test_${timestamp}@example.com`;
    const testDob = '1995-08-25';

    const regResult = await registerUser({
      name: testName,
      email: testEmail,
      dob: testDob
    });

    assert(Boolean(regResult), 'registerUser returned valid response');
    assert(Boolean(regResult.user && regResult.user.id), `User created with ID: ${regResult.user.id}`);
    assert(regResult.user.email === testEmail, `User email stored correctly: ${regResult.user.email}`);
    assert(regResult.user.dob === testDob, `User DOB stored correctly: ${regResult.user.dob}`);

    // Verify auto-generated username
    const generatedUsername = regResult.username;
    console.log(`  ✨ Auto-generated username: @${generatedUsername}`);
    assert(Boolean(generatedUsername && generatedUsername.startsWith('rohit_')), 'Username formatted with name slug prefix');

    // Verify auto-generated password
    const generatedPassword = regResult.password;
    console.log(`  ✨ Auto-generated secure password: ${generatedPassword}`);
    assert(Boolean(generatedPassword && generatedPassword.length >= 10), 'Password generated with at least 10 chars');
    assert(generatedPassword.startsWith('Namo#'), 'Password contains secure Namo# standard prefix');

    // Verify JWT Token
    assert(Boolean(regResult.token), 'JWT Token generated on registration');
    const decodedToken = verifyToken(regResult.token);
    assert(decodedToken && decodedToken.email === testEmail, 'JWT Token payload verified');

    // Verify DB Query by Email and by Username
    const userByEmail = await findUserByEmailOrUsername(testEmail);
    assert(Boolean(userByEmail && userByEmail.id === regResult.user.id), 'findUserByEmailOrUsername matches email');

    const userByUsername = await findUserByEmailOrUsername(generatedUsername);
    assert(Boolean(userByUsername && userByUsername.id === regResult.user.id), 'findUserByEmailOrUsername matches username');

    // -------------------------------------------------------------
    // TEST 4: Email Notification Dispatcher (Admin & User)
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Testing Mailer Dispatcher for Registration...');
    const mailResult = await sendRegistrationEmails({
      name: testName,
      email: testEmail,
      dob: testDob,
      username: generatedUsername,
      password: generatedPassword
    });

    assert(mailResult.success === true, 'sendRegistrationEmails completed without failing');
    console.log('  Admin alert sent status:', mailResult.notificationSent);
    console.log('  User welcome sent status:', mailResult.welcomeSent);
    if (mailResult.adminPreviewUrl) {
      console.log(`  Admin preview URL: ${mailResult.adminPreviewUrl}`);
    }
    if (mailResult.userPreviewUrl) {
      console.log(`  User preview URL: ${mailResult.userPreviewUrl}`);
    }

    // -------------------------------------------------------------
    // TEST 5: Login via Generated Username + Password
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Testing Login using Generated Username + Password...');
    const loginUsernameResult = await loginUser({
      username: generatedUsername,
      password: generatedPassword
    });

    assert(Boolean(loginUsernameResult && loginUsernameResult.token), 'Login via username succeeded with JWT');
    assert(loginUsernameResult.user.email === testEmail, 'User profile returned correctly on username login');
    assert(loginUsernameResult.user.username === generatedUsername, 'User username matched');

    // -------------------------------------------------------------
    // TEST 6: Login via Email + Password
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Testing Login using Email + Password...');
    const loginEmailResult = await loginUser({
      email: testEmail,
      password: generatedPassword
    });

    assert(Boolean(loginEmailResult && loginEmailResult.token), 'Login via email succeeded with JWT');
    assert(loginEmailResult.user.id === regResult.user.id, 'User ID matched on email login');

    // -------------------------------------------------------------
    // TEST 7: Login via Single "identifier" Parameter
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Testing Login using flexible "identifier" parameter...');
    const loginIdentifierResult = await loginUser({
      identifier: generatedUsername,
      password: generatedPassword
    });
    assert(Boolean(loginIdentifierResult.token), 'Login using identifier=username passed');

    const loginIdentifierEmailResult = await loginUser({
      identifier: testEmail,
      password: generatedPassword
    });
    assert(Boolean(loginIdentifierEmailResult.token), 'Login using identifier=email passed');

    // -------------------------------------------------------------
    // TEST 8: Super Admin Account Pre-Seeding
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Verifying Super Admin account login...');
    const adminLoginResult = await loginUser({
      identifier: SUPER_ADMIN_CREDENTIALS.email,
      password: SUPER_ADMIN_CREDENTIALS.password
    });
    assert(Boolean(adminLoginResult.token), 'Super Admin login passed');
    assert(adminLoginResult.user.role === 'superadmin', 'Super Admin role verified');

    // -------------------------------------------------------------
    // TEST 9: Negative Validations
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Testing Negative Auth Validation Cases...');
    let invalidPassCaught = false;
    try {
      await loginUser({
        identifier: generatedUsername,
        password: 'WrongPassword123!'
      });
    } catch {
      invalidPassCaught = true;
    }
    assert(invalidPassCaught, 'Rejected login with invalid password');

    let duplicateEmailCaught = false;
    try {
      await registerUser({
        name: 'Duplicate Guy',
        email: testEmail,
        dob: '1998-01-01'
      });
    } catch {
      duplicateEmailCaught = true;
    }
    assert(duplicateEmailCaught, 'Rejected duplicate email registration');

    console.log('\n===============================================================');
    console.log(`🎉 ALL ${passed} VERIFICATION TESTS PASSED SUCCESSFULLY! (0 failures)`);
    console.log('===============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ TEST SUITE FAILED: ${err.message}\n`, err.stack);
    process.exit(1);
  }
}

runTestAuthDbSuite();
