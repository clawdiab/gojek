# gojek

Un-official Go-jek API Wrapper. API end point known by decompile the android APK.

- [Have trouble ?](https://github.com/mychaelgo/gojek/issues)
- [Submit changes/features ?](https://github.com/mychaelgo/gojek/pulls)

This repository contains 3 main API:

- GoID API (Authentication specific API)
- Gojek API (core functionality for Gojek services)
- GoPay API (GoPay specific API)

you can see list of package [here](https://github.com/mychaelgo?tab=packages&repo_name=gojek)

Part of my [personal finance automation](https://github.com/mychaelgo/personal-finances-automation)

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `GOJEK_CLIENT_SECRET` — Obtain by decompiling the latest Gojek APK using [apktool](https://apktool.org/) or [jadx](https://github.com/skylot/jadx)
- `GOJEK_PHONE_NUMBER` — Your phone number (without country code)
- `GOJEK_ACCESS_TOKEN` — Obtained after completing the OTP login flow (for API/GoPay endpoints)

Optional variables (have sensible defaults):
- `GOJEK_CLIENT_ID` — defaults to `gojek:consumer:app`
- `GOJEK_APP_VERSION` — update to match the APK version you decompiled
- `GOJEK_UNIQUE_ID` — auto-generated if not set

### 2. Obtaining Credentials from APK

```bash
# Download latest Gojek APK from APKMirror or APKPure
# Decompile with jadx
jadx -d output/ gojek.apk

# Search for client_secret
grep -r "client_secret" output/
grep -r "<YOUR_CLIENT_SECRET>" output/
```

### 3. Authentication Flow

1. Set `GOJEK_CLIENT_SECRET` and `GOJEK_PHONE_NUMBER` in `.env`
2. Run `node examples/node/goid/auth.js` to request OTP
3. Enter the OTP received via WhatsApp/SMS to generate tokens
4. Set `GOJEK_ACCESS_TOKEN` in `.env` with the received `access_token`
5. Now you can use the API and GoPay examples

## Documentation

All API documented in [docs directory](docs/) with OpenAPI format v3.0

## SDK

Available in [sdk directory](sdk/) and generated using [OpenAPI Generator](https://openapi-generator.tech/)

### Using NodeJS

You need to setting `.npmrc` like this. You need personal access token in order to download the package, see [here](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

```bash
@mychaelgo:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_REGISTRY_TOKEN}
```

After setup complete, now you install any package you want.

```bash
npm install @mychaelgo/goid-gojek
npm install @mychaelgo/gopay-gojek
npm install @mychaelgo/api-gojek
npm install @mychaelgo/gojek-auth
```

You also need `dotenv` for the examples. If you are running them from the repository root, initialize a Node project first:

```bash
npm init -y
cd examples/node/goid && npm install dotenv
```

### Using Go

WIP
