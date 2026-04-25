#!/usr/bin/env node
/**
 * Gojek Login Script
 * 
 * Usage:
 *   1. First capture headers using mitmproxy (see PROXY_SETUP.md)
 *   2. Run: node tools/gojek_login.js request <phone_number>
 *   3. Wait for OTP
 *   4. Run: node tools/gojek_login.js verify <otp_token> <otp_code>
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CAPTURED_HEADERS_FILE = path.join(__dirname, '..', 'gojek_captured_headers.json');
const TOKENS_FILE = path.join(__dirname, '..', 'gojek_tokens.json');

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'x-appversion': '5.57.2',
  'x-appid': 'com.gojek.app',
  'x-deviceos': 'Android,14',
  'x-user-type': 'customer',
  'x-phonemake': 'Samsung',
  'x-phonemodel': 'SM-G998B',
  'x-pushtokentype': 'FCM',
  'x-platform': 'Android',
  'x-uniqueid': require('crypto').randomBytes(8).toString('hex'),
  'User-Agent': 'okhttp/4.12.0',
  'gojek-country-code': 'ID',
};

function loadCapturedHeaders() {
  try {
    const data = JSON.parse(fs.readFileSync(CAPTURED_HEADERS_FILE, 'utf8'));
    // Find accounts.goto-products.com headers
    const goidData = data['accounts.goto-products.com'] || Object.values(data)[0];
    if (goidData && goidData.headers) {
      console.log('[+] Loaded captured headers from proxy session');
      return goidData.headers;
    }
  } catch (e) {
    // No captured headers available
  }
  return null;
}

function getHeaders() {
  const captured = loadCapturedHeaders();
  if (captured) {
    // Merge captured headers (they take priority)
    const merged = { ...BASE_HEADERS };
    for (const [key, value] of Object.entries(captured)) {
      merged[key] = value;
    }
    if (captured['x-firebase-appcheck']) {
      console.log('[+] Firebase App Check token found in captured headers');
    }
    return merged;
  }
  
  // Check for manual token in env
  if (process.env.GOJEK_APPCHECK_TOKEN) {
    console.log('[+] Using Firebase App Check token from environment');
    return { ...BASE_HEADERS, 'x-firebase-appcheck': process.env.GOJEK_APPCHECK_TOKEN };
  }
  
  console.log('[!] No captured headers or App Check token found');
  console.log('[!] Trying without App Check (may fail with v5.x API)');
  return BASE_HEADERS;
}

function makeRequest(method, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'accounts.goto-products.com',
      path: urlPath,
      method: method,
      headers: headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function requestOTP(phoneNumber) {
  // Strip leading 0 or +62
  phoneNumber = phoneNumber.replace(/^(\+62|62|0)/, '');
  
  console.log(`\n[*] Requesting OTP for +62${phoneNumber}...`);
  
  const headers = getHeaders();
  const clientId = process.env.GOJEK_CLIENT_ID || 'gojek:consumer:app';
  const clientSecret = process.env.GOJEK_CLIENT_SECRET || (() => { throw new Error('GOJEK_CLIENT_SECRET env var required'); })();

  // Step 1: Get login methods
  console.log('[*] Step 1: Getting login methods...');
  const methodsBody = {
    client_id: clientId,
    client_secret: clientSecret,
    country_code: '+62',
    email: '',
    phone_number: phoneNumber,
  };

  const methodsResult = await makeRequest('POST', '/goto-auth/login/methods', methodsBody, headers);
  console.log(JSON.stringify(methodsResult.data, null, 2));

  if (!methodsResult.data.data || !methodsResult.data.data.verification_id) {
    console.log('\n[-] Failed to get login methods');
    if (methodsResult.data.errors) {
      const err = methodsResult.data.errors[0];
      console.log(`    Code: ${err.code}`);
      console.log(`    Message: ${err.message}`);
      if (err.code === 'GoPay-1000') {
        console.log('\n[!] This error usually means Firebase App Check token is missing or invalid.');
        console.log('[!] Please capture headers from a real device first. See tools/PROXY_SETUP.md');
      }
    }
    return null;
  }

  const verificationId = methodsResult.data.data.verification_id;
  const methods = methodsResult.data.data.methods || ['otp_sms'];
  console.log(`\n[+] verification_id: ${verificationId}`);
  console.log(`[+] Available methods: ${methods.join(', ')}`);

  // Step 2: Initiate OTP via CVS
  console.log('\n[*] Step 2: Initiating OTP via CVS...');
  const otpMethod = methods.includes('otp_sms') ? 'otp_sms' : methods[0];
  const initiateBody = {
    client_id: clientId,
    client_secret: clientSecret,
    flow: 'login_1fa',
    verification_id: verificationId,
    verification_method: otpMethod,
    country_code: '+62',
    phone_number: phoneNumber,
  };

  const initiateResult = await makeRequest('POST', '/cvs/v1/initiate', initiateBody, headers);
  console.log(JSON.stringify(initiateResult.data, null, 2));

  if (!initiateResult.data.data || !initiateResult.data.data.otp_token) {
    console.log('\n[-] Failed to initiate OTP');
    return null;
  }

  const otpToken = initiateResult.data.data.otp_token;
  const otpLength = initiateResult.data.data.otp_length || 4;
  console.log(`\n[+] OTP sent! otp_token: ${otpToken}`);
  console.log(`[+] OTP length: ${otpLength}`);
  console.log(`\n[*] Next step: node tools/gojek_login.js verify ${verificationId} ${otpToken} <OTP_CODE>`);
  
  return { verificationId, otpToken };
}

async function verifyOTP(verificationId, otpToken, otpCode) {
  console.log(`\n[*] Verifying OTP ${otpCode}...`);
  
  const headers = getHeaders();
  const clientId = process.env.GOJEK_CLIENT_ID || 'gojek:consumer:app';
  const clientSecret = process.env.GOJEK_CLIENT_SECRET || (() => { throw new Error('GOJEK_CLIENT_SECRET env var required'); })();

  // Step 3: Verify OTP via CVS
  console.log('[*] Step 3: Verifying OTP via CVS...');
  const verifyBody = {
    client_id: clientId,
    client_secret: clientSecret,
    flow: 'login_1fa',
    verification_id: verificationId,
    verification_method: 'otp_sms',
    data: {
      otp: otpCode,
      otp_token: otpToken,
    },
  };

  const verifyResult = await makeRequest('POST', '/cvs/v1/verify', verifyBody, headers);
  console.log(JSON.stringify(verifyResult.data, null, 2));

  if (!verifyResult.data.data || !verifyResult.data.data.verification_token) {
    console.log('\n[-] OTP verification failed');
    return;
  }

  const verificationToken = verifyResult.data.data.verification_token;
  console.log(`\n[+] verification_token: ${verificationToken.substring(0, 40)}...`);

  // Step 4: Get account list
  console.log('\n[*] Step 4: Getting account list...');
  const accountListBody = {
    client_id: clientId,
    client_secret: clientSecret,
    verification_token: verificationToken,
  };

  const accountResult = await makeRequest('POST', '/goto-auth/accountlist', accountListBody, headers);
  console.log(JSON.stringify(accountResult.data, null, 2));

  if (!accountResult.data.data || !accountResult.data.data.account_list) {
    console.log('\n[-] Failed to get account list');
    return;
  }

  const accountList = accountResult.data.data.account_list;
  const token1fa = accountResult.data.data['1fa_token'];
  const account = accountList[0];
  console.log(`\n[+] account_id: ${account.account_id}`);

  // Step 5: Exchange for access token
  console.log('\n[*] Step 5: Exchanging for access token...');
  const tokenBody = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'cvs',
    token: token1fa,
    account_id: account.account_id,
    scopes: [],
  };

  const tokenResult = await makeRequest('POST', '/goto-auth/token', tokenBody, headers);
  console.log(JSON.stringify(tokenResult.data, null, 2));

  if (tokenResult.data.data && tokenResult.data.data.access_token) {
    console.log('\n[+] Login successful!');
    console.log(`    Access Token: ${tokenResult.data.data.access_token.substring(0, 30)}...`);
    
    // Save tokens
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokenResult.data.data, null, 2));
    console.log(`[+] Tokens saved to ${TOKENS_FILE}`);
  } else if (tokenResult.data.access_token) {
    console.log('\n[+] Login successful!');
    console.log(`    Access Token: ${tokenResult.data.access_token.substring(0, 30)}...`);
    
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokenResult.data, null, 2));
    console.log(`[+] Tokens saved to ${TOKENS_FILE}`);
  } else {
    console.log('\n[-] Token exchange failed');
  }
}

// CLI
const [,, command, ...args] = process.argv;

switch (command) {
  case 'request':
    if (!args[0]) {
      console.log('Usage: node gojek_login.js request <phone_number>');
      process.exit(1);
    }
    requestOTP(args[0]).catch(console.error);
    break;
    
  case 'verify':
    if (!args[0] || !args[1] || !args[2]) {
      console.log('Usage: node gojek_login.js verify <verification_id> <otp_token> <otp_code>');
      process.exit(1);
    }
    verifyOTP(args[0], args[1], args[2]).catch(console.error);
    break;
    
  default:
    console.log('Gojek Login Tool');
    console.log('');
    console.log('Usage:');
    console.log('  node tools/gojek_login.js request <phone_number>                          - Request OTP (steps 1-2)');
    console.log('  node tools/gojek_login.js verify <verification_id> <otp_token> <otp>      - Verify OTP & get access token (steps 3-5)');
    console.log('');
    console.log('Environment variables:');
    console.log('  GOJEK_APPCHECK_TOKEN  - Firebase App Check token (from proxy capture)');
    console.log('  GOJEK_CLIENT_ID       - Client ID (default: gojek:consumer:app)');
    console.log('  GOJEK_CLIENT_SECRET   - Client secret');
}