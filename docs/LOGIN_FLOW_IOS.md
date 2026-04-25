# Gojek iOS Login Flow

## Overview

The iOS app uses a different authentication flow than Android. Key differences:
- **No Firebase App Check required** (Android requires `X-Firebase-AppCheck` header)
- Uses `accounts.goto-products.com` for authentication
- Uses `customer.gopayapi.com` for PIN verification

## Authentication Endpoints

### 1. SSO Login (Device-based)

**Endpoint:** `POST https://accounts.goto-products.com/goto-auth/sso/login`

**Request Body:**
```json
{
  "host_device_id": "<device-uuid>",
  "authorizer_id": "gopay:consumer:app",
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "client_device_id": "<device-uuid>",
  "sha_key": "com.go-jek.ios"
}
```

**Response:**
```json
{
  "data": {
    "account_list": [{
      "account_id": "<account-id>",
      "fullname": "<user-name>",
      "email": "<user-email>",
      "phone_number": "<phone-number>",
      "country_code": "+62"
    }],
    "registered": true,
    "auth_code": "<JWE-token>"
  }
}
```

### 2. Token Exchange

**Endpoint:** `POST https://accounts.goto-products.com/goto-auth/token`

**Request Body:**
```json
{
  "client_id": "gojek:consumer:app",
  "account_id": "<account-id>",
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "grant_type": "auth_code",
  "token": "<auth-...otp>"
}
```

**Response:**
```json
{
  "data": {
    "access_token": "***",
    "refresh_token": "***",
    "expires_in": 3600
  }
}
```

### 3. Login Methods (Phone Number Check)

**Endpoint:** `POST https://accounts.goto-products.com/goto-auth/login/methods`

**Request Body:**
```json
{
  "email": "",
  "client_id": "gojek:consumer:app",
  "country_code": "+62",
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "phone_number": "<phone-number>"
}
```

**Response (User Found):**
```json
{
  "data": {
    "methods": ["otp_sms", "otp_wa"],
    "verification_id": "<uuid>"
  }
}
```

### 4. CVS Initiate (Request OTP)

**Endpoint:** `POST https://accounts.goto-products.com/cvs/v1/initiate`

**Request Body:**
```json
{
  "flow": "login",
  "client_id": "gojek:consumer:app",
  "verification_id": "<from login/methods>",
  "verification_method": "otp_sms",
  "country_code": "+62",
  "phone_number": "<phone-number>",
  "client_secret": "<YOUR_CLIENT_SECRET>"
}
```

**Response:**
```json
{
  "data": {
    "otp_token": "<uuid>",
    "otp_length": 4,
    "retry_timer_in_seconds": [60, 60]
  }
}
```

### 5. CVS Verify (Submit OTP)

**Endpoint:** `POST https://accounts.goto-products.com/cvs/v1/verify`

**Request Body:**
```json
{
  "client_id": "gojek:consumer:app",
  "verification_id": "<from login/methods>",
  "otp_token": "<from cvs/initiate>",
  "otp": "1234",
  "client_secret": "<YOUR_CLIENT_SECRET>"
}
```

### 6. PIN Verification

**Endpoint:** `POST https://customer.gopayapi.com/api/v1/users/pin/tokens/nb`

**Headers:**
- `X-Verification: PIN`
- `X-E1`, `X-E2`, `X-E3`, `X-M1` (signature headers)

**Request Body:**
```json
{
  "pin": "<encrypted-pin>",
  "challenge_id": "<from pin-page endpoint>"
}
```

## Required Headers for All Requests

### Device Headers
- `X-AppId: com.go-jek.ios`
- `X-AppVersion: 5.57.2`
- `X-DeviceOS: iOS, 26.3.1`
- `X-PhoneMake: Apple`
- `X-PhoneModel: Apple, iPhone 17 Pro Max`
- `X-Platform: iOS`
- `X-UniqueId: <device-uuid>`
- `X-Session-ID: <session-uuid>`
- `X-DeviceToken: <apns-token>`

### Signature Headers (Required for API calls)
- `X-E1: <per-request-signature>` - Tied to URL path, changes per request
- `X-E2: <device-fingerprint>` - Static per device
- `X-E3: <md5-of-request-body>` - For GET: `<<md5-empty-body>>`
- `X-M1: <key-value-pairs-with-timestamp>`

### Location Headers (Optional)
- `X-Location: <lat>,<lng>`
- `Gojek-Country-Code: ID`
- `Gojek-Timezone: Asia/Jakarta`

## Token Format

Tokens are JWE (JSON Web Encryption) format:
- 5 parts separated by dots
- Header: `{"alg":"dir","cty":"JWT","enc":"A128GCM","typ":"JWT","zip":"DEF"}`
- ~1300 characters

## Credentials

- `client_id: gojek:consumer:app`
- `client_secret: <YOUR_CLIENT_SECRET>`
- `authorizer_id: gopay:consumer:app`

## Key Differences from Android

1. **No Firebase App Check** - iOS app doesn't use it
2. **Different signature generation** - X-E1 format differs
3. **Uses `accounts.goto-products.com`** instead of `goid.gojekapi.com`
4. **PIN verification via `gopayapi.com`** not `gojekapi.com`