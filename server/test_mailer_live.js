import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getTransporter, sendRegistrationEmails } from './mailer.js';

const rootEnv = path.resolve(process.cwd(), '.env');
const parentEnv = path.resolve(process.cwd(), '..', '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
}

console.log('='.repeat(60));
console.log('📧 TESTING LIVE REGISTRATION EMAIL DISPATCH VIA GMAIL');
console.log('='.repeat(60));

async function run() {
  const testUserData = {
    name: 'Rohit Jigar Test',
    email: 'rohitjigarmaheshbhai@gmail.com',
    dob: '2000-01-01',
    username: 'rohit_test_' + Math.floor(100 + Math.random() * 900),
    password: 'Namo#Test' + Math.floor(1000 + Math.random() * 9000) + '!'
  };

  console.log('Dispatching test credentials to:', testUserData.email);
  console.log('Dispatching admin notification to: rohitjigarmaheshbhai@gmail.com');

  const result = await sendRegistrationEmails(testUserData);
  console.log('\nDispatch Result:', JSON.stringify(result, null, 2));

  if (result.notificationSent && result.welcomeSent) {
    console.log('\n🎉 SUCCESS: Both Admin notification and User welcome email were delivered via Gmail SMTP!');
  } else {
    console.log('\nNotice: Check dispatch status flags above.');
  }
}

run().catch(err => {
  console.error('Test error:', err);
});
