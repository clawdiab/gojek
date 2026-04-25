"use strict";
/**
 * Gojek Authentication SDK
 * Handles authentication via accounts.goto-products.com
 *
 * Based on captured iOS traffic from Gojek app v5.57.2
 *
 * LOGIN FLOWS:
 *
 * 1. PIN Flow (for existing users with PIN set):
 *    POST /goto-auth/login/methods → verification_id
 *    POST /cvs/v1/initiate (goto_pin) → challenge_id
 *    POST /cvs/v1/verify (validation_jwt) → verification_token
 *    POST /goto-auth/accountlist → 1fa_token
 *    POST /goto-auth/token (grant_type: cvs) → access_token
 *
 * 2. OTP Flow (for users without PIN or choosing OTP):
 *    POST /goto-auth/login/methods → verification_id
 *    POST /cvs/v1/initiate (otp_sms/otp_wa) → otp_token
 *    POST /cvs/v1/verify (otp code) → verification_token
 *    POST /goto-auth/accountlist → 1fa_token
 *    POST /goto-auth/token (grant_type: cvs) → access_token
 *
 * 3. SSO Flow (for trusted/already-logged-in devices):
 *    POST /goto-auth/sso/login → auth_code
 *    POST /goto-auth/token (grant_type: auth_code) → access_token
 *
 * LIMITATIONS:
 * - X-E1 header: Per-request signature, cannot be generated without reverse-engineering iOS app
 * - validation_jwt: RS256-signed JWT containing encrypted PIN, generated client-side
 * - Without X-E1, API returns GoPay-1000 error
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthApi = exports.DEFAULT_X_E2 = exports.DEFAULT_CLIENT_ID = exports.BASE_PATH = void 0;
exports.createIOSDeviceConfig = createIOSDeviceConfig;
exports.createAndroidDeviceConfig = createAndroidDeviceConfig;
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
// Base URL for authentication
exports.BASE_PATH = 'https://accounts.goto-products.com';
// Default public identifiers. Do not hardcode or export client secrets;
// callers must provide clientSecret from secure configuration (e.g. .env).
exports.DEFAULT_CLIENT_ID = 'gojek:consumer:app';
// Static device fingerprint (X-E2) - captured from iOS device
exports.DEFAULT_X_E2 = 'C3948F5848C29AB28455A1BFA32A8';
/**
 * Create default device config for iOS
 */
function createIOSDeviceConfig() {
    const generateUUID = () => crypto.randomUUID().toUpperCase();
    return {
        appId: 'com.go-jek.ios',
        appVersion: '5.57.2',
        deviceOs: 'iOS, 26.3.1',
        phoneMake: 'Apple',
        phoneModel: 'Apple, iPhone 17 Pro Max',
        platform: 'iOS',
        pushTokenType: 'APN',
        uniqueId: generateUUID(),
        sessionId: generateUUID(),
        xE2: exports.DEFAULT_X_E2,
    };
}
/**
 * Create default device config for Android
 */
function createAndroidDeviceConfig() {
    const generateHexId = () => crypto.randomBytes(8).toString('hex').toUpperCase();
    return {
        appId: 'com.gojek.app',
        appVersion: '5.57.2',
        deviceOs: 'Android, 14',
        phoneMake: 'Samsung',
        phoneModel: 'SM-G998B',
        platform: 'Android',
        pushTokenType: 'FCM',
        uniqueId: generateHexId(),
        sessionId: generateHexId(),
    };
}
// ==================== Auth API Class ====================
/**
 * Gojek Authentication API
 *
 * IMPORTANT: Most endpoints require X-E1 signature header which is generated
 * by the iOS/Android app using a proprietary algorithm. Without valid X-E1,
 * the API returns "GoPay-1000" error.
 *
 * Workaround: Capture X-E1 from a real device using mitmproxy and pass it
 * via the signatureHeaders parameter. Note that X-E1 is request-specific
 * and expires quickly.
 */
class AuthApi {
    constructor(deviceConfig, clientId = exports.DEFAULT_CLIENT_ID, clientSecret = '', basePath = exports.BASE_PATH) {
        if (!clientSecret) {
            throw new Error('clientSecret is required and must not be empty. Obtain it from the Gojek APK.');
        }
        this.deviceConfig = deviceConfig || createIOSDeviceConfig();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.sessionTimestamp = Date.now();
        this.axios = axios_1.default.create({
            baseURL: basePath,
            timeout: 30000,
        });
    }
    /**
     * Generate X-M1 header value
     * Format: 3:<sessionTs>-<uniqueId>,12:VKEY_DISABLED,13:1001,14:<currentTs>
     * Note: Order of components can vary
     */
    generateXM1() {
        const now = Math.floor(Date.now() / 1000);
        const uniqueIdShort = this.deviceConfig.uniqueId.split('-')[0];
        return `13:1001,14:${now},3:${this.sessionTimestamp}-${uniqueIdShort},12:VKEY_DISABLED`;
    }
    /**
     * Calculate X-E3 (MD5 of request body)
     * For GET requests, use MD5 of empty string: d41d8cd98f00b204e9800998ecf8427e
     */
    calculateXE3(body) {
        if (!body) {
            return 'd41d8cd98f00b204e9800998ecf8427e';
        }
        const bodyStr = JSON.stringify(body);
        return crypto.createHash('md5').update(bodyStr).digest('hex');
    }
    /**
     * Get default headers for auth requests
     */
    getDefaultHeaders() {
        const headers = {
            'X-AppId': this.deviceConfig.appId,
            'X-AppVersion': this.deviceConfig.appVersion,
            'X-DeviceOS': this.deviceConfig.deviceOs,
            'X-PhoneMake': this.deviceConfig.phoneMake,
            'X-PhoneModel': this.deviceConfig.phoneModel,
            'X-Platform': this.deviceConfig.platform,
            'X-PushTokenType': this.deviceConfig.pushTokenType,
            'X-UniqueId': this.deviceConfig.uniqueId,
            'X-Session-ID': this.deviceConfig.sessionId,
            'X-User-Type': 'customer',
            'X-Updater': '1',
            'X-M1': this.generateXM1(),
            'X-E2': this.deviceConfig.xE2 || exports.DEFAULT_X_E2,
            'Gojek-Country-Code': 'ID',
            'Gojek-Timezone': 'Asia/Jakarta',
            'X-User-Locale': 'en_ID',
            'Accept-Language': 'en-ID',
            'X-AuthSDK-Version': '3.16.1',
            'X-CVSDK-Version': '1.0.83',
        };
        if (this.deviceConfig.deviceToken) {
            headers['X-DeviceToken'] = this.deviceConfig.deviceToken;
        }
        return headers;
    }
    /**
     * Step 1: Get available login methods for a phone number
     * Returns verification_id and available methods (goto_pin, otp_sms, otp_wa, otp_email)
     */
    async getLoginMethods(phoneNumber, countryCode = '+62', signatureHeaders) {
        const body = {
            phone_number: phoneNumber,
            email: '',
            client_id: this.clientId,
            country_code: countryCode,
            client_secret: this.clientSecret,
        };
        const headers = {
            ...this.getDefaultHeaders(),
            'Content-Type': 'application/json',
            'X-E3': this.calculateXE3(body),
        };
        if (signatureHeaders === null || signatureHeaders === void 0 ? void 0 : signatureHeaders.X_E1) {
            headers['X-E1'] = signatureHeaders.X_E1;
        }
        const response = await this.axios.post('/goto-auth/login/methods', body, { headers });
        return response.data;
    }
    /**
     * Step 2: Initiate verification (PIN or OTP)
     * For PIN: verification_method = 'goto_pin', flow = 'login_1fa'
     * For OTP: verification_method = 'otp_sms' or 'otp_wa', flow = 'login_1fa'
     */
    async initiateVerification(verificationId, verificationMethod, phoneNumber, countryCode = '+62', flow = 'login_1fa', signatureHeaders) {
        const body = {
            verification_method: verificationMethod,
            is_multiple_method: true,
            phone_number: phoneNumber,
            client_secret: this.clientSecret,
            verification_id: verificationId,
            flow: flow,
            country_code: countryCode,
            client_id: this.clientId,
        };
        const headers = {
            ...this.getDefaultHeaders(),
            'Content-Type': 'application/json',
            'X-E3': this.calculateXE3(body),
        };
        if (signatureHeaders === null || signatureHeaders === void 0 ? void 0 : signatureHeaders.X_E1) {
            headers['X-E1'] = signatureHeaders.X_E1;
        }
        const response = await this.axios.post('/cvs/v1/initiate', body, { headers });
        return response.data;
    }
    /**
     * Step 3: Verify PIN or OTP
     *
     * For PIN: data = { challenge_id, validation_jwt }
     *   - validation_jwt is an RS256-signed JWT generated client-side by the app
     *   - We cannot generate this without the app's private key
     *
     * For OTP: data = { otp, otp_token }
     *   - otp is the 4-digit code received via SMS/WhatsApp
     *   - otp_token is from initiateVerification response
     */
    async verifyCode(verificationId, verificationMethod, data, flow = 'login_1fa', signatureHeaders) {
        const body = {
            flow: flow,
            client_id: this.clientId,
            verification_id: verificationId,
            client_secret: this.clientSecret,
            verification_method: verificationMethod,
            data: data,
        };
        const headers = {
            ...this.getDefaultHeaders(),
            'Content-Type': 'application/json',
            'X-E3': this.calculateXE3(body),
        };
        if (signatureHeaders === null || signatureHeaders === void 0 ? void 0 : signatureHeaders.X_E1) {
            headers['X-E1'] = signatureHeaders.X_E1;
        }
        const response = await this.axios.post('/cvs/v1/verify', body, { headers });
        return response.data;
    }
    /**
     * Step 4: Get account list with verification token
     * Returns 1fa_token needed for final token exchange
     */
    async getAccountList(verificationToken, signatureHeaders) {
        const body = {
            client_secret: this.clientSecret,
            client_id: this.clientId,
        };
        const headers = {
            ...this.getDefaultHeaders(),
            'Content-Type': 'application/json',
            'X-E3': this.calculateXE3(body),
            'Verification-Token': `Bearer ${verificationToken}`,
        };
        if (signatureHeaders === null || signatureHeaders === void 0 ? void 0 : signatureHeaders.X_E1) {
            headers['X-E1'] = signatureHeaders.X_E1;
        }
        const response = await this.axios.post('/goto-auth/accountlist', body, { headers });
        return response.data;
    }
    /**
     * Step 5: Exchange verification token for access token
     * grant_type: 'cvs' for PIN/OTP flow, 'auth_code' for SSO flow
     */
    async exchangeToken(token, accountId, grantType = 'cvs', signatureHeaders) {
        const body = {
            token: token,
            grant_type: grantType,
            client_id: this.clientId,
            account_id: accountId,
            client_secret: this.clientSecret,
        };
        const headers = {
            ...this.getDefaultHeaders(),
            'Content-Type': 'application/json',
            'X-E3': this.calculateXE3(body),
        };
        if (signatureHeaders === null || signatureHeaders === void 0 ? void 0 : signatureHeaders.X_E1) {
            headers['X-E1'] = signatureHeaders.X_E1;
        }
        const response = await this.axios.post('/goto-auth/token', body, { headers });
        return response.data;
    }
    /**
     * SSO Login - Device-based authentication for trusted devices
     * Returns list of accounts registered on this device and an auth_code
     * NOTE: Only works on devices that have been previously logged in
     */
    async ssoLogin(signatureHeaders) {
        const body = {
            host_device_id: this.deviceConfig.uniqueId,
            authorizer_id: 'gopay:consumer:app',
            client_secret: this.clientSecret,
            client_device_id: this.deviceConfig.uniqueId,
            sha_key: this.deviceConfig.appId,
        };
        const headers = {
            ...this.getDefaultHeaders(),
            'Content-Type': 'application/json',
            'X-E3': this.calculateXE3(body),
        };
        if (signatureHeaders === null || signatureHeaders === void 0 ? void 0 : signatureHeaders.X_E1) {
            headers['X-E1'] = signatureHeaders.X_E1;
        }
        const response = await this.axios.post('/goto-auth/sso/login', body, { headers });
        return response.data;
    }
    /**
     * Logout - Invalidate current session
     */
    async logout(accessToken, signatureHeaders) {
        const headers = {
            ...this.getDefaultHeaders(),
            'Authorization': `Bearer ${accessToken}`,
            'X-E3': 'd41d8cd98f00b204e9800998ecf8427e',
        };
        if (signatureHeaders === null || signatureHeaders === void 0 ? void 0 : signatureHeaders.X_E1) {
            headers['X-E1'] = signatureHeaders.X_E1;
        }
        await this.axios.delete('/goto-auth/token', { headers });
    }
    /**
     * Get device config (for debugging)
     */
    getDeviceConfig() {
        return { ...this.deviceConfig };
    }
}
exports.AuthApi = AuthApi;
// ==================== Exports ====================
exports.default = AuthApi;
