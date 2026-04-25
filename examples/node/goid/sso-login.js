/**
 * Gojek Authentication Example - SSO Login
 * 
 * SSO login uses device-based authentication and requires X-M1 header; X-E1 is also likely required.
 * This works if your device is already registered with Gojek.
 * 
 * Usage:
 *   node sso-login.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { AuthApi, createIOSDeviceConfig } = require('../../../sdk/auth-gojek-node/dist');

async function main() {
  const deviceConfig = createIOSDeviceConfig();
  const clientId = process.env.GOJEK_CLIENT_ID || 'gojek:consumer:app';
  const clientSecret = process.env.GOJEK_CLIENT_SECRET || '';
  const auth = new AuthApi(deviceConfig, clientId, clientSecret);

  console.log('=== Gojek SSO Login ===\n');
  console.log(`Device ID: ${deviceConfig.uniqueId}`);
  console.log(`Session ID: ${deviceConfig.sessionId}`);
  console.log(`Platform: ${deviceConfig.platform}\n`);

  try {
    console.log('[1/2] Attempting SSO login...');
    const response = await auth.ssoLogin();

    if (!response.success) {
      console.error('SSO login failed:', response.errors?.[0]?.message);
      console.log('\nThis device is not registered. Use OTP login instead.');
      process.exit(1);
    }

    console.log('[2/2] SSO login successful!\n');

    if (response.data.account_list.length === 0) {
      console.log('No accounts found on this device.');
      process.exit(0);
    }

    console.log('=== Registered Accounts ===\n');
    for (const account of response.data.account_list) {
      console.log(`Account ID: ${account.account_id}`);
      console.log(`Name: ${account.fullname}`);
      console.log(`Phone: +${account.country_code}${account.phone_number}`);
      console.log(`Email: ${account.email}`);
      console.log(`Last Active: ${account.last_active}`);
      console.log('');
    }

    console.log(`Auth Code: ${response.data.auth_code.substring(0, 50)}...`);
    console.log('\nNote: To exchange auth_code for access_token, you need X-E1/E2/E3 signature headers.');
    console.log('These can be captured from a real device using mitmproxy.');

  } catch (error) {
    console.error('\nSSO login failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();