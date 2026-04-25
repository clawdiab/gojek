# Proxy Setup Guide for Capturing Gojek Auth Headers

This guide explains how to capture Firebase App Check tokens from a real Gojek app session using mitmproxy.

## Prerequisites

- A computer running this proxy (the server where Hermes is running)
- An Android phone with Gojek app installed
- Both devices on the same network

## Step 1: Start the Proxy Server

On your computer:

```bash
cd ~/gojek
/tmp/mitmdump -s tools/capture_gojek_auth.py --set block_global=false -p 8080
```

The proxy will start on port 8080. Keep this terminal open.

## Step 2: Get Your Computer's IP Address

```bash
# On the server
ip addr show | grep "inet " | grep -v 127.0.0.1
```

Note the IP address (e.g., `192.168.1.100` or `100.82.92.113` for LAN).

## Step 3: Configure Android Phone

1. **Connect to the same WiFi network** as your computer

2. **Set HTTP Proxy**:
   - Go to Settings → WiFi → Long press your network → Modify network
   - Advanced options → Proxy → Manual
   - Hostname: `<your-computer-ip>`
   - Port: `8080`
   - Save

3. **Install mitmproxy CA Certificate**:
   - Open Chrome on your phone
   - Go to `http://mitm.it`
   - Download the certificate for Android
   - Install it: Settings → Security → Install from storage → Select the certificate
   - Name it "mitmproxy" and select "VPN and apps"

4. **Trust the certificate** (Android 7+):
   - Settings → Security → Trusted credentials → User
   - Enable the mitmproxy certificate

## Step 4: Capture Headers

1. Open the Gojek app on your phone
2. Log in or perform any action that triggers an API call
3. Watch the proxy terminal for captured headers
4. When you see `★★★ FIREBASE APP CHECK TOKEN CAPTURED ★★★`, you got it!

The headers are saved to `~/gojek/gojek_captured_headers.json`.

## Step 5: Use Captured Headers

Now you can run the login script:

```bash
cd ~/gojek

# Request OTP
node tools/gojek_login.js request <PHONE_NUMBER>

# After receiving OTP via WhatsApp/SMS
node tools/gojek_login.js verify <otp_token> <otp_code>
```

## Troubleshooting

### "Network error" on phone
- Make sure firewall allows port 8080
- Check that both devices are on the same network

### "Certificate not trusted"
- Make sure you installed the certificate for "VPN and apps"
- On Android 11+, you may need to use a different approach (see below)

### Android 11+ Certificate Issues

On newer Android versions, user certificates are not trusted by apps by default. Solutions:

1. **Use Android 10 or lower** (easiest)

2. **Root your phone** and push the certificate to system store:
   ```bash
   adb root
   adb remount
   adb push mitmproxy-ca-cert.cer /system/etc/security/cacerts/
   ```

3. **Use Frida** to bypass certificate pinning (advanced)

4. **Use an emulator** with root access:
   - Android Studio AVD with Google Play
   - Nox or LDPlayer with root enabled

## Alternative: Use Emulator

If you have an Android emulator with root:

1. Install Gojek APK on emulator
2. Set proxy to your computer's IP:8080
3. Push mitmproxy certificate to system store:
   ```bash
   adb root
   adb remount
   adb push /tmp/mitmproxy-ca-cert.cer /system/etc/security/cacerts/
   adb shell chmod 644 /system/etc/security/cacerts/mitmproxy-ca-cert.cer
   adb reboot
   ```
4. Open Gojek and capture headers

## Notes

- Firebase App Check tokens expire after some time (usually 1 hour)
- You may need to re-capture if the token expires
- The captured headers include device-specific identifiers that may be tied to your phone