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
  const body = {
    client_id: process.env.GOJEK_CLIENT_ID || 'gojek:consumer:app',
    client_secret: process.env.GOJEK_CLIENT_SECRET || (() => { throw new Error('GOJEK_CLIENT_SECRET env var required'); })(),
    country_code: '+62',
    login_type: 'otp_whatsapp',
    magic_link_ref: '',
    phone_number: phoneNumber,
  };

  const result = await makeRequest('POST', '/goto-auth/login/methods', body, headers);
  
  console.log('\n[*] Response:');
  console.log(JSON.stringify(result.data, null, 2));
  
  if (result.data.success !== false && result.data.data) {
    const otpToken = result.data.data.otp_token;
    console.log(`\n[+] OTP sent! Token: ${otpToken}`);
    console.log(`\n[*] Next step: node tools/gojek_login.js verify ${otpToken} <OTP_CODE>`);
    return otpToken;
  } else {
    console.log('\n[-] OTP request failed');
    if (result.data.errors) {
      const err = result.data.errors[0];
      console.log(`    Code: ${err.code}`);
      console.log(`    Message: ${err.message}`);
      if (err.code === 'GoPay-1000') {
        console.log('\n[!] This error usually means Firebase App Check token is missing or invalid.');
        console.log('[!] Please capture headers from a real device first. See tools/PROXY_SETUP.md');
      }
    }
  }
}

async function verifyOTP(otpToken, otpCode) {
  console.log(`\n[*] Verifying OTP ${otpCode} with token ${otpToken}...`);
  
  const headers = getHeaders();
  const body = {
    client_id: process.env.GOJEK_CLIENT_ID || 'gojek:consumer:app',
    client_secret: process.env.GOJEK_CLIENT_SECRET || (() => { throw new Error('GOJEK_CLIENT_SECRET env var required'); })(),
    data: {
      otp: otpCode,
      otp_token: otpToken,
    },
    grant_type: 'otp',
    scopes: [],
  };

  const result = await makeRequest('POST', '/goto-auth/token', body, headers);
  
  console.log('\n[*] Response:');
  console.log(JSON.stringify(result.data, null, 2));
  
  if (result.data.access_token) {
    console.log('\n[+] Login successful!');
    console.log(`    Access Token: ${result.data.access_token.substring(0, 30)}...`);
    
    // Save tokens
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(result.data, null, 2));
    console.log(`[+] Tokens saved to ${TOKENS_FILE}`);
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
    if (!args[0] || !args[1]) {
      console.log('Usage: node gojek_login.js verify <otp_token> <otp_code>');
      process.exit(1);
    }
    verifyOTP(args[0], args[1]).catch(console.error);
    break;
    
  default:
    console.log('Gojek Login Tool');
    console.log('');
    console.log('Usage:');
    console.log('  node tools/gojek_login.js request <phone_number>   - Request OTP');
    console.log('  node tools/gojek_login.js verify <token> <otp>     - Verify OTP & get access token');
    console.log('');
    console.log('Environment variables:');
    console.log('  GOJEK_APPCHECK_TOKEN  - Firebase App Check token (from proxy capture)');
    console.log('  GOJEK_CLIENT_ID       - Client ID (default: gojek:consumer:app)');
    console.log('  GOJEK_CLIENT_SECRET   - Client secret');
}