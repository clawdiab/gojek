require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const crypto = require('crypto');
const { PaymentApi, Configuration } = require('../../../sdk/gopay-gojek-node/dist');

// Read configuration from environment variables
const config = {
    accessToken: process.env.GOJEK_ACCESS_TOKEN,
    appVersion: process.env.GOJEK_APP_VERSION || '5.57.2',
    appId: process.env.GOJEK_APP_ID || 'com.gojek.app',
    deviceOs: process.env.GOJEK_DEVICE_OS || 'Android,10',
    phoneMake: process.env.GOJEK_PHONE_MAKE || 'Samsung',
    phoneModel: process.env.GOJEK_PHONE_MODEL || 'GT-S7500',
    platform: process.env.GOJEK_PLATFORM || 'Android',
    pushTokenType: process.env.GOJEK_PUSH_TOKEN_TYPE || 'FCM',
    uniqueId: process.env.GOJEK_UNIQUE_ID || crypto.randomBytes(8).toString('hex'),
};

if (!config.accessToken) {
    console.error('Error: GOJEK_ACCESS_TOKEN is required. Set it in .env file.');
    console.error('Obtain it by completing the OTP login flow (see examples/node/goid/auth.js)');
    process.exit(1);
}

const paymentAPI = new PaymentApi(new Configuration({ accessToken: config.accessToken }));

const defaultHeaders = {
    xAppid: config.appId,
    xAppversion: config.appVersion,
    xDeviceos: config.deviceOs,
    xPhonemake: config.phoneMake,
    xPhonemodel: config.phoneModel,
    xPlatform: config.platform,
    xPushtokentype: config.pushTokenType,
    xUniqueid: config.uniqueId,
    xUserType: 'customer',
    gojekCountryCode: 'ID'
};

const getBalance = async () => {
    try {
        const response = await paymentAPI.getBalances({
            ...defaultHeaders
        });
        console.log({ balances: response.data });
    } catch (error) {
        console.error('Failed to get balance:', error.response?.data || error.message);
    }
};

getBalance();