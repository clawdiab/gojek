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
export declare const BASE_PATH = "https://accounts.goto-products.com";
export declare const DEFAULT_CLIENT_ID = "gojek:consumer:app";
export declare const DEFAULT_X_E2 = "C3948F5848C29AB28455A1BFA32A8";
/**
 * Device configuration for API requests
 */
export interface DeviceConfig {
    appId: string;
    appVersion: string;
    deviceOs: string;
    phoneMake: string;
    phoneModel: string;
    platform: string;
    pushTokenType: string;
    uniqueId: string;
    sessionId: string;
    deviceToken?: string;
    xE2?: string;
}
/**
 * Create default device config for iOS
 */
export declare function createIOSDeviceConfig(): DeviceConfig;
/**
 * Create default device config for Android
 */
export declare function createAndroidDeviceConfig(): DeviceConfig;
export interface LoginMethodsResponse {
    data?: {
        default_method: string;
        methods: string[];
        verification_id: string;
        social_media_linking?: {
            is_google_linked: boolean;
            is_apple_linked: boolean;
        };
        phone_number: string;
        country_code: string;
    };
    success: boolean;
    errors?: Array<{
        code: string;
        message: string;
        message_title?: string;
    }>;
}
export interface CVSInitiateResponse {
    data?: {
        otp_token?: string;
        otp_length?: number;
        retry_timer_in_seconds?: number[];
        metadata?: {
            phone: string;
        };
        challenge_id?: string;
        fr_token_details?: {
            challenge_token: string;
            user_token: string;
        };
        device_mapped_for_dbl?: boolean;
    };
    success: boolean;
    errors?: Array<{
        code: string;
        message: string;
    }>;
}
export interface CVSVerifyResponse {
    data?: {
        verification_token: string;
    };
    success: boolean;
    errors?: Array<{
        code: string;
        message: string;
    }>;
}
export interface AccountListResponse {
    data?: {
        account_list: Array<{
            account_id: string;
            fullname: string;
            email: string;
            phone_number: string;
            image: string;
        }>;
        '1fa_token': string;
    };
    success: boolean;
    errors?: Array<{
        code: string;
        message: string;
    }>;
}
export interface TokenExchangeResponse {
    data?: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
    };
    success: boolean;
    errors?: Array<{
        code: string;
        message: string;
    }>;
}
export interface SSOLoginResponse {
    data?: {
        account_list: Array<{
            account_id: string;
            fullname: string;
            email: string;
            phone_number: string;
            country_code: string;
            image: string;
            last_active: string;
        }>;
        registered: boolean;
        auth_code: string;
    };
    success: boolean;
    errors?: Array<{
        code: string;
        message: string;
    }>;
}
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
export declare class AuthApi {
    private axios;
    private deviceConfig;
    private clientId;
    private clientSecret;
    private sessionTimestamp;
    constructor(deviceConfig?: DeviceConfig, clientId?: string, clientSecret?: string, basePath?: string);
    /**
     * Generate X-M1 header value
     * Format: 3:<sessionTs>-<uniqueId>,12:VKEY_DISABLED,13:1001,14:<currentTs>
     * Note: Order of components can vary
     */
    private generateXM1;
    /**
     * Calculate X-E3 (MD5 of request body)
     * For GET requests, use MD5 of empty string: d41d8cd98f00b204e9800998ecf8427e
     */
    private calculateXE3;
    /**
     * Get default headers for auth requests
     */
    private getDefaultHeaders;
    /**
     * Step 1: Get available login methods for a phone number
     * Returns verification_id and available methods (goto_pin, otp_sms, otp_wa, otp_email)
     */
    getLoginMethods(phoneNumber: string, countryCode?: string, signatureHeaders?: {
        X_E1: string;
    }): Promise<LoginMethodsResponse>;
    /**
     * Step 2: Initiate verification (PIN or OTP)
     * For PIN: verification_method = 'goto_pin', flow = 'login_1fa'
     * For OTP: verification_method = 'otp_sms' or 'otp_wa', flow = 'login_1fa'
     */
    initiateVerification(verificationId: string, verificationMethod: 'goto_pin' | 'otp_sms' | 'otp_wa' | 'otp_email', phoneNumber: string, countryCode?: string, flow?: string, signatureHeaders?: {
        X_E1: string;
    }): Promise<CVSInitiateResponse>;
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
    verifyCode(verificationId: string, verificationMethod: 'goto_pin' | 'otp_sms' | 'otp_wa' | 'otp_email', data: {
        challenge_id: string;
        validation_jwt: string;
    } | {
        otp: string;
        otp_token: string;
    }, flow?: string, signatureHeaders?: {
        X_E1: string;
    }): Promise<CVSVerifyResponse>;
    /**
     * Step 4: Get account list with verification token
     * Returns 1fa_token needed for final token exchange
     */
    getAccountList(verificationToken: string, signatureHeaders?: {
        X_E1: string;
    }): Promise<AccountListResponse>;
    /**
     * Step 5: Exchange verification token for access token
     * grant_type: 'cvs' for PIN/OTP flow, 'auth_code' for SSO flow
     */
    exchangeToken(token: string, accountId: string, grantType?: 'cvs' | 'auth_code' | 'onetap', signatureHeaders?: {
        X_E1: string;
    }): Promise<TokenExchangeResponse>;
    /**
     * SSO Login - Device-based authentication for trusted devices
     * Returns list of accounts registered on this device and an auth_code
     * NOTE: Only works on devices that have been previously logged in
     */
    ssoLogin(signatureHeaders?: {
        X_E1: string;
    }): Promise<SSOLoginResponse>;
    /**
     * Logout - Invalidate current session
     */
    logout(accessToken: string, signatureHeaders?: {
        X_E1: string;
    }): Promise<void>;
    /**
     * Get device config (for debugging)
     */
    getDeviceConfig(): DeviceConfig;
}
export default AuthApi;
