1|     1|# gojek
     2|     2|
     3|     3|Un-official Go-jek API Wrapper. API end point known by decompile the android APK.
     4|     4|
     5|     5|- [Have trouble ?](https://github.com/mychaelgo/gojek/issues)
     6|     6|- [Submit changes/features ?](https://github.com/mychaelgo/gojek/pulls)
     7|     7|
     8|     8|This repository contains 3 main API:
     9|     9|
    10|    10|- GoID API (Authentication specific API)
    11|    11|- Gojek API (core functionality for Gojek services)
    12|    12|- GoPay API (GoPay specific API)
    13|    13|
    14|    14|you can see list of package [here](https://github.com/mychaelgo?tab=packages&repo_name=gojek)
    15|    15|
    16|    16|Part of my [personal finance automation](https://github.com/mychaelgo/personal-finances-automation)
    17|    17|
    18|    18|## Setup
    19|    19|
    20|    20|### 1. Environment Variables
    21|    21|
    22|    22|Copy `.env.example` to `.env` and fill in your credentials:
    23|    23|
    24|    24|```bash
    25|    25|cp .env.example .env
    26|    26|```
    27|    27|
    28|    28|Required variables:
    29|    29|- `GOJEK_CLIENT_SECRET` — Obtain by decompiling the latest Gojek APK using [apktool](https://apktool.org/) or [jadx](https://github.com/skylot/jadx)
    30|    30|- `GOJEK_PHONE_NUMBER` — Your phone number (without country code)
    31|    31|- `GOJEK_ACCESS_TOKEN` — Obtained after completing the OTP login flow (for API/GoPay endpoints)
    32|    32|
    33|    33|Optional variables (have sensible defaults):
    34|    34|- `GOJEK_CLIENT_ID` — defaults to `gojek:consumer:app`
    35|    35|- `GOJEK_APP_VERSION` — update to match the APK version you decompiled
    36|    36|- `GOJEK_UNIQUE_ID` — auto-generated if not set
    37|    37|
    38|    38|### 2. Obtaining Credentials from APK
    39|    39|
    40|    40|```bash
    41|    41|# Download latest Gojek APK from APKMirror or APKPure
    42|    42|# Decompile with jadx
    43|    43|jadx -d output/ gojek.apk
    44|    44|
    45|    45|# Search for client_secret
    46|    46|grep -r "client_secret" output/
    47|    47|grep -r "<YOUR_CLIENT_SECRET>" output/
    48|    48|```
    49|    49|
    50|    50|### 3. Authentication Flow
    51|    51|
    52|    52|1. Set `GOJEK_CLIENT_SECRET` and `GOJEK_PHONE_NUMBER` in `.env`
    53|    53|2. Run `node examples/node/goid/auth.js` to request OTP
    54|    54|3. Enter the OTP received via WhatsApp/SMS to generate tokens
    55|    55|4. Set `GOJEK_ACCESS_TOKEN` in `.env` with the received `access_token`
    56|    56|5. Now you can use the API and GoPay examples
    57|    57|
    58|    58|## Documentation
    59|    59|
    60|    60|All API documented in [docs directory](docs/) with OpenAPI format v3.0
    61|    61|
    62|    62|## SDK
    63|    63|
    64|    64|Available in [sdk directory](sdk/) and generated using [OpenAPI Generator](https://openapi-generator.tech/)
    65|    65|
    66|    66|### Using NodeJS
    67|    67|
    68|    68|You need to setting `.npmrc` like this. You need personal access token in order to download the package, see [here](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
    69|    69|
    70|    70|```bash
    71|    71|@mychaelgo:registry=https://npm.pkg.github.com
    72|    72|//npm.pkg.github.com/:_authToken=${GITHUB_REGISTRY_TOKEN}
    73|    73|```
    74|    74|
    75|    75|After setup complete, now you install any package you want.
    76|    76|
    77|    77|```bash
    78|    78|npm install @mychaelgo/goid-gojek
    79|    79|npm install @mychaelgo/gopay-gojek
    80|    80|npm install @mychaelgo/api-gojek
    81|    81|npm install @mychaelgo/gojek-auth
    82|    82|```
    83|    83|
    84|    84|You also need `dotenv` for the examples. If you are running them from the repository root, initialize a Node project first:
    85|    85|
    86|    86|```bash
    87|    87|npm init -y
    88|    88|cd examples/node/goid && npm install dotenv
    89|    89|```
    90|    90|
    91|    91|### Using Go
    92|    92|
    93|    93|WIP
    94|    94|