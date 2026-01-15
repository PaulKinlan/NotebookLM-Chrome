# Chrome Web Store Deployment

This extension is automatically published to the Chrome Web Store when a release is created on the `main` branch.

## Setup

### 1. Get Chrome Web Store API Credentials

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Select your extension
3. Go to **Package** → **Publishing**
4. Click the link to generate API credentials

You'll need:
- **Publisher ID** - Displayed in the Account section of the Developer Dashboard
- **Extension ID** - Your extension's ID in the Chrome Web Store
- **Client ID** - From the API credentials
- **Client Secret** - From the API credentials
- **Refresh Token** - From the API credentials

See the [Chrome Web Store API documentation](https://developer.chrome.com/docs/webstore/using-api) for detailed instructions.

### 2. Configure GitHub Secrets

Add the following secrets to your GitHub repository (**Settings** → **Secrets and variables** → **Actions**):

| Secret Name | Description |
|-------------|-------------|
| `CWS_PUBLISHER_ID` | Chrome Web Store publisher ID |
| `CWS_EXTENSION_ID` | Chrome Web Store extension ID |
| `CWS_CLIENT_ID` | Chrome Web Store API client ID |
| `CWS_CLIENT_SECRET` | Chrome Web Store API client secret |
| `CWS_REFRESH_TOKEN` | Chrome Web Store API refresh token |

### 3. Release Process

Once configured, releases happen automatically:

1. Push conventional commits to `main` branch
2. CI runs tests and builds
3. semantic-release determines version based on commits
4. GitHub release is created with the extension ZIP
5. Extension is published to Chrome Web Store

**Commit types:**
- `feat:` → minor version bump (0.2.0 → 0.3.0)
- `fix:` → patch version bump (0.2.0 → 0.2.1)
- `BREAKING CHANGE:` → major version bump (0.2.0 → 1.0.0)

## Local Testing

To test Chrome Web Store publishing locally:

```bash
CWS_EXTENSION_ID="your-extension-id" \
CWS_PUBLISHER_ID="your-publisher-id" \
CWS_CLIENT_ID="your-client-id" \
CWS_CLIENT_SECRET="your-client-secret" \
CWS_REFRESH_TOKEN="your-refresh-token" \
npx tsx scripts/publish-cws.ts
```

## Implementation

The publishing is done using the native Chrome Web Store API via `fetch` (built into Node.js 18+). The script `scripts/publish-cws.ts`:

1. Exchanges the refresh token for an access token
2. Uploads the extension ZIP to the Chrome Web Store
3. Publishes the extension to the public channel

No external dependencies are required beyond the Chrome Web Store API credentials.
