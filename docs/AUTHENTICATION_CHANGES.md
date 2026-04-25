# Gojek Authentication Changes

## Overview

Gojek has migrated authentication from `goid.gojekapi.com` to `accounts.goto-products.com`. This document describes the new authentication flows based on captured iOS traffic from Gojek app v5.57.2.

## Base URL

```
Old: https://goid.gojekapi.com
New: https://accounts.goto-products.com
```

## Authentication Flows

### 1. PIN Flow (Existing Users)

For users who have set up a PIN on their account:

```
POST /goto-auth/login/methods     → verification_id
POST /cvs/v1/initiate (goto_pin)  → challenge_id
POST /cvs/v1/verify (validation_jwt) → verification_token
POST /goto-auth/accountlist       → 1fa_token
POST /goto-auth/token (grant_type: cvs) → access_token
```

**Limitation**: The `validation_jwt` is an RS256-signed JWT containing the encrypted PIN, generated client-side by the iOS/Android app. This cannot be replicated without reverse-engineering the app's signing logic.

### 2. OTP Flow (SMS/WhatsApp)

For users choosing OTP verification:

```
POST /goto-auth/login/methods  → verification_id
POST /cvs/v1/initiate (otp_sms/otp_wa) → otp_token
POST /cvs/v1/verify (otp code) → verification_token
POST /goto-auth/accountlist    → 1fa_token
POST /goto-auth/token (grant_type: cvs) → access_token
```

**Note**: OTP verification sends a 4-digit code to the user's phone. The `otp_token` from initiate step must be included in the verify request.

### 3. SSO Flow (Trusted Devices)

For devices that have been previously logged in:

```
POST /goto-auth/sso/login → auth_code
POST /goto-auth/token (grant_type: auth_code) → access_token
```

**Note**: SSO login only works on trusted devices. It returns `GoPay-1000` on fresh devices.

## API Endpoints

### POST /goto-auth/login/methods

Get available login methods for a phone number.

**Request:**
```json
{
  "phone_number": "<PHONE_NUMBER>",
  "email": "",
  "client_id": "gojek:consumer:app",
  "country_code": "+62",
  "client_secret": "<YOUR_CLIENT_SECRET>"
}
```

**Response:**
```json
{
  "data": {
    "default_method": "goto_pin",
    "methods": ["goto_pin", "otp_email", "otp_wa", "otp_sms"],
    "verification_id": "<VERIFICATION_ID>",
    "social_media_linking": {
      "is_google_linked": false,
      "is_apple_linked": false
    },
    "phone_number": "<PHONE_NUMBER>",
    "country_code": "+62"
  },
  "success": true
}
```

### POST /cvs/v1/initiate

Initiate verification (PIN or OTP).

**Request (PIN):**
```json
{
  "verification_method": "goto_pin",
  "is_multiple_method": true,
  "phone_number": "<PHONE_NUMBER>",
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "verification_id": "<VERIFICATION_ID>",
  "flow": "login_1fa",
  "country_code": "+62",
  "client_id": "gojek:consumer:app"
}
```

**Response (PIN):**
```json
{
  "data": {
    "challenge_id": "<<uuid>>",
    "fr_token_details": {
      "challenge_token": "",
      "user_token": ""
    },
    "device_mapped_for_dbl": false
  },
  "success": true
}
```

**Response (OTP):**
```json
{
  "data": {
    "otp_token": "<<uuid>>",
    "otp_length": 4,
    "retry_timer_in_seconds": [60, 60],
    "metadata": {
      "phone": "+62********7851"
    }
  },
  "success": true
}
```

### POST /cvs/v1/verify

Verify PIN or OTP code.

**Request (PIN):**
```json
{
  "flow": "login_1fa",
  "client_id": "gojek:consumer:app",
  "verification_id": "<VERIFICATION_ID>",
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "verification_method": "goto_pin",
  "data": {
    "challenge_id": "<<uuid>>",
    "validation_jwt": "eyJ0eX...NiJ9..."
  }
}
```

**Request (OTP):**
```json
{
  "flow": "login_1fa",
  "client_id": "gojek:consumer:app",
  "verification_id": "<VERIFICATION_ID>",
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "verification_method": "otp_sms",
  "data": {
    "otp": "1234",
    "otp_token": "<<uuid>>"
  }
}
```

**Response:**
```json
{
  "data": {
    "verification_token": "eyJhbG...GIn0..."
  },
  "success": true
}
```

### POST /goto-auth/accountlist

Get account list with verification token.

**Headers:**
```
Verification-Token: Bearer <verification_token>
```

**Request:**
```json
{
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "client_id": "gojek:consumer:app"
}
```

**Response:**
```json
{
  "data": {
    "account_list": [
      {
        "account_id": "<ACCOUNT_ID>",
        "fullname": "",
        "email": "",
        "phone_number": "",
        "image": ""
      }
    ],
    "1fa_token": "***..."
  },
  "success": true
}
```

### POST /goto-auth/token

Exchange verification token for access token.

**Request:**
```json
{
  "token": "<1fa_t...ode>",
  "grant_type": "cvs",
  "client_id": "gojek:consumer:app",
  "account_id": "<ACCOUNT_ID>",
  "client_secret": "<YOUR_CLIENT_SECRET>"
}
```

**Response:**
```json
{
  "data": {
    "access_token": "eyJhbG...0..."
  },
  "success": true
}
```

### POST /goto-auth/sso/login

SSO login for trusted devices.

**Request:**
```json
{
  "host_device_id": "<DEVICE_UUID>",
  "authorizer_id": "gopay:consumer:app",
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "client_device_id": "<DEVICE_UUID>",
  "sha_key": "com.go-jek.ios"
}
```

**Response:**
```json
{
  "data": {
    "account_list": [
      {
        "account_id": "<ACCOUNT_ID>",
        "fullname": "<FULL_NAME>",
        "email": "<EMAIL>",
        "phone_number": "<PHONE_NUMBER>",
        "country_code": "+62",
        "image": "",
        "last_active": "<TIMESTAMP>"
      }
    ],
    "registered": true,
    "auth_code": "***..."
  },
  "success": true
}
```

## Required Headers

All requests require these headers:

| Header | Description | Example |
|--------|-------------|---------|
| X-AppId | App bundle ID | `com.go-jek.ios` |
| X-AppVersion | App version | `5.57.2` |
| X-DeviceOS | OS version | `iOS, 26.3.1` |
| X-PhoneMake | Device manufacturer | `Apple` |
| X-PhoneModel | Device model | `Apple, iPhone 17 Pro Max` |
| X-Platform | Platform | `iOS` |
| X-UniqueId | Device UUID | `<DEVICE_UUID>` |
| X-Session-ID | Session UUID | `<SESSION_UUID>` |
| X-M1 | Timestamp token | `13:1001,14:<<timestamp_s>>,3:<<timestamp_ms>>-<<unique-id-prefix>>,12:VKEY_DISABLED` |
| X-E1 | Request signature | `<<x-e1-signature>>...` |
| X-E2 | Device fingerprint | `<<device-fingerprint>>` |
| X-E3 | Body MD5 hash | `<<md5-hash>>` |

## X-E1 Signature Header

**CRITICAL**: The `X-E1` header is a per-request signature that is required for all API calls. Without it, the API returns `GoPay-1000` error.

**Format:**
```
<part1>:<part2>:N:<timestamp_ms>
```

**Part1** (32 bytes / 64 hex): Per-request HMAC-SHA256 hash with a key embedded in the app binary. Unique for every request.

**Part2** (80 bytes / 160 hex) binary structure:
```
Bytes  0-31: Random/encrypted blob (varies per request)
Bytes 32-39: 8-char base62 nonce (alphanumeric, e.g. "VJCxNPaD")
Bytes 40-43: Varying uint32 (possibly memory address)
Bytes 44-47: 01000000 = LE uint32(1) — version marker
Bytes 48-55: Session constant (rotates every ~15-20s, 4 unique values observed)
Bytes 56-59: Varying uint32 (possibly memory address)
Bytes 60-63: 01000000 = LE uint32(1) — version marker
Bytes 64-79: Per-request MAC/hash (16 bytes)
```

**Analysis** (from 179 captured requests across 4 sessions):
- Part1 is always unique per request — likely HMAC-SHA256 with an obfuscated key
- The session constant at bytes 48-55 rotates every ~15-20 seconds (observed values: `f900cb948adb5cc7`, `43005044e886c603`, `5400290c3c82ed44`, `f8000b5ca0857547`)
- Bytes 44-47 and 60-63 are always `01000000` (LE uint32 = 1)
- The base62 nonce uses all 62 alphanumeric characters with uniform distribution
- Generated by a native security SDK (likely Promon SHIELD or similar) embedded in the iOS/Android binary

**Limitation**: X-E1 cannot be replicated in Node.js without:
1. Extracting the signing key from the iOS/Android binary via Frida + IDA Pro
2. Or using a jailbroken/rooted device with Frida to hook the X-E1 generator function

**Workaround**: Use mitmproxy to capture live traffic from a real device. Note that X-E1 is per-request and expires immediately — captured values cannot be replayed.

## X-E3 Header

The `X-E3` header is the MD5 hash of the request body.

**For POST requests:**
```javascript
const xE3 = crypto.createHash('md5').update(JSON.stringify(body)).digest('hex');
```

**For GET requests:**
```
X-E3: <<md5-empty-body>>
```
(MD5 of empty string)

## X-M1 Header

The `X-M1` header contains timestamp and device info.

**Format:**
```
3:<timestamp_ms>-<uniqueId_prefix>,12:VKEY_DISABLED,13:1001,14:<timestamp_s>
```

**Example:**
```
3:<<timestamp_ms>>-<<unique-id-prefix>>,12:VKEY_DISABLED,13:1001,14:<<timestamp_s>>
```

Note: The order of components can vary.

## Token Format

Access tokens are JWE (JSON Web Encryption) tokens with the following header:

```json
{
  "alg": "dir",
  "cty": "JWT",
  "enc": "A128GCM",
  "typ": "JWT",
  "zip": "DEF"
}
```

Tokens are approximately 1300 characters long and are deflated before encryption.

## Credentials

| Parameter | Value |
|-----------|-------|
| client_id | `gojek:consumer:app` |
| client_secret | `<YOUR_CLIENT_SECRET>` |
| authorizer_id | `gopay:consumer:app` |

## Error Codes

| Code | Description |
|------|-------------|
| `GoPay-1000` | Missing or invalid X-E1 signature |
| `auth:error:user:not_found` | Phone number not registered |
| `auth:error:invalid_otp` | Invalid OTP code |
| `auth:error:pin_locked` | PIN locked due to too many attempts |

## Migration Guide

### Old Code (goid.gojekapi.com)

```javascript
// Old endpoint - returns 404
const response = await axios.post('https://goid.gojekapi.com/v1/login/methods', body);
```

### New Code (accounts.goto-products.com)

```javascript
// New endpoint
const auth = new AuthApi(deviceConfig);
const response = await auth.getLoginMethods(phoneNumber, countryCode, { X_E1 });
```

## SDK Usage

```javascript
const { AuthApi, createIOSDeviceConfig } = require('@mychaelgo/gojek-auth');

// Create API instance
const device = createIOSDeviceConfig();
const auth = new AuthApi(device);

// Get login methods (requires X-E1 from captured traffic)
const methods = await auth.getLoginMethods('<PHONE_NUMBER>', '+62', { X_E1: capturedXE1 });

// Initiate OTP
const initiate = await auth.initiateVerification(
  methods.data.verification_id,
  'otp_sms',
  '<PHONE_NUMBER>',
  '+62',
  'login_1fa',
  { X_E1: capturedXE1 }
);

// Verify OTP
const verify = await auth.verifyCode(
  methods.data.verification_id,
  'otp_sms',
  { otp: '1234', otp_token: initiate.data.otp_token },
  'login_1fa',
  { X_E1: capturedXE1 }
);

// Get account list
const accounts = await auth.getAccountList(verify.data.verification_token, { X_E1: capturedXE1 });

// Exchange for access token
const token = await auth.exchangeToken(
  accounts.data['1fa_token'],
  accounts.data.account_list[0].account_id,
  'cvs',
  { X_E1: capturedXE1 }
);

console.log('Access token:', token.data.access_token);
```