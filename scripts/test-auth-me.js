const fetch = require('node-fetch');

async function testAuth(email, password) {
  console.log(`\n=== Testing Auth for ${email} ===`);
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  console.log('Login Response:', loginRes.status, JSON.stringify(loginData, null, 2));

  if (!loginData.accessToken) {
    console.error('No access token returned!');
    return;
  }

  const meRes = await fetch('http://localhost:3000/api/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${loginData.accessToken}`,
    },
  });
  const meData = await meRes.json();
  console.log('/auth/me Response:', meRes.status, JSON.stringify(meData, null, 2));
}

async function run() {
  await testAuth('techplast_corp@techplast.tn', 'Password123');
  await testAuth('contact@techplast.tn', 'Password123');
}

run().catch(console.error);
