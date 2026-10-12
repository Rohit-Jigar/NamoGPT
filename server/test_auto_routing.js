import axios from 'axios';

const BASE_URL = 'http://localhost:3001/v1/chat/completions';

async function runTests() {
  console.log('====================================================');
  console.log('🤖 NAMOGPT AUTO ROUTER & LITELLM INTELLIGENCE TESTS');
  console.log('====================================================\n');

  // TEST 1: Auto Mode - General Conversation
  console.log('--- TEST 1: Auto Mode -> General Conversation ---');
  try {
    const res = await axios.post(BASE_URL, {
      model: 'auto',
      messages: [{ role: 'user', content: 'Say hello concisely.' }]
    });
    console.log('✓ Status:', res.status);
    console.log('✓ Model used:', res.data.model);
    console.log('✓ Content:', res.data.choices?.[0]?.message?.content?.trim());
  } catch (err) {
    console.error('✗ Test 1 failed:', err.response?.status, err.response?.data || err.message);
  }

  // TEST 2: Auto Mode - Real-time News / Weather intent
  console.log('\n--- TEST 2: Auto Mode -> Real-time News / Weather Intent ---');
  try {
    const res = await axios.post(BASE_URL, {
      model: 'auto',
      messages: [{ role: 'user', content: 'What is the latest breaking news headline today?' }]
    });
    console.log('✓ Status:', res.status);
    console.log('✓ Model used:', res.data.model);
    console.log('✓ Content preview:', res.data.choices?.[0]?.message?.content?.slice(0, 150) + '...');
  } catch (err) {
    console.error('✗ Test 2 failed:', err.response?.status, err.response?.data || err.message);
  }

  // TEST 3: Auto Mode - Complex STEM / Reasoning intent
  console.log('\n--- TEST 3: Auto Mode -> Complex STEM / Reasoning Intent ---');
  try {
    const res = await axios.post(BASE_URL, {
      model: 'auto',
      messages: [{ role: 'user', content: 'Prove whether the square root of 2 is rational or irrational. Calculate and show step-by-step.' }]
    });
    console.log('✓ Status:', res.status);
    console.log('✓ Model used:', res.data.model);
    console.log('✓ Content preview:', res.data.choices?.[0]?.message?.content?.slice(0, 150) + '...');
  } catch (err) {
    console.error('✗ Test 3 failed:', err.response?.status, err.response?.data || err.message);
  }

  // TEST 4: Auto Mode - Vision / Image input
  console.log('\n--- TEST 4: Auto Mode -> Vision / Image Intent ---');
  try {
    const res = await axios.post(BASE_URL, {
      model: 'auto',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is depicted in this image?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' } }
        ]
      }]
    });
    console.log('✓ Status:', res.status);
    console.log('✓ Model used:', res.data.model);
    console.log('✓ Content preview:', res.data.choices?.[0]?.message?.content?.slice(0, 150) + '...');
  } catch (err) {
    console.error('✗ Test 4 failed:', err.response?.status, err.response?.data || err.message);
  }

  // TEST 5: Robust Failover - When requesting a pool that encounters errors, cascades to next key / pool
  console.log('\n--- TEST 5: Robust Failover -> Cascade across keys and pools without dropping user ---');
  try {
    const res = await axios.post(BASE_URL, {
      model: 'deepseek-r1',
      messages: [{ role: 'user', content: 'What is 5 factorial? Answer in one number.' }]
    });
    console.log('✓ Status:', res.status);
    console.log('✓ Model used:', res.data.model);
    console.log('✓ Content:', res.data.choices?.[0]?.message?.content?.trim());
  } catch (err) {
    console.error('✗ Test 5 failed:', err.response?.status, err.response?.data || err.message);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL AUTO ROUTER TESTS COMPLETED');
  console.log('====================================================');
}

runTests();
