# OAuth Setup Guide for HNNT

This guide explains how to configure AWS Cognito for seamless OAuth authentication in both development and production environments.

## Current Configuration Status

- **User Pool ID**: `us-west-2_G1vzYe7Fm`
- **App Client ID**: `59birgscfcc9lguiq3765tcumk`
- **OAuth Domain**: `auth-hnnt-app-dev.auth.us-west-2.amazoncognito.com`
- **Providers**: Google, Facebook/Instagram

## AWS Cognito Console Configuration

### 1. Navigate to Cognito User Pool
1. Go to AWS Console → Cognito → User Pools
2. Select: `us-west-2_G1vzYe7Fm`
3. Go to **App Integration** tab → **App client settings**

### 2. Configure OAuth Redirect URIs

**For Development Environment:**
Add these URLs to **Allowed callback URLs** and **Allowed sign out URLs**:
```
exp://localhost:19000/
exp://192.168.1.103:8081/
exp://127.0.0.1:19000/
exp://[::1]:19000/
exp://10.0.2.2:8081/
exp://172.16.0.1:8081/
exp://192.168.1.1:8081/
```

**For Production Environment:**
Add these URLs to **Allowed callback URLs** and **Allowed sign out URLs**:
```
hnnt://
https://www.hnnt.app/auth/callback/
```

### 3. Configure OAuth Providers

#### Google OAuth Setup
1. In Cognito → **Identity providers** → **Google**
2. **App ID**: `798510659255-2p2fnrcnii2kta3gootr007q9s2k7jbn.apps.googleusercontent.com`
3. **App secret**: [From Google Cloud Console]
4. **Authorized scopes**: `openid email profile`
5. **Attribute mapping**:
   - `email` → `email`
   - `name` → `name`
   - `sub` → `username`

#### Facebook/Instagram OAuth Setup
1. In Cognito → **Identity providers** → **Facebook**
2. **App ID**: `2033331813827444`
3. **App secret**: [From Meta Developer Console]
4. **Authorized scopes**: `email,public_profile`
5. **Attribute mapping**:
   - `email` → `email`
   - `name` → `name`
   - `id` → `username`

## Development Environment Setup

### 1. Test Your Configuration
```bash
# Start Expo development server
npx expo start

# Note the IP address shown in the console
# Example: exp://192.168.1.103:8081/
```

### 2. Update Cognito if Needed
If your development IP changes:
1. Check the console output for the current IP
2. Add the new IP to Cognito's allowed URLs
3. Our dynamic configuration will automatically use the correct IP

### 3. Verify Configuration
The app will log the current OAuth configuration:
```
🔧 Amplify OAuth Configuration: {
  redirectUri: "exp://192.168.1.103:8081/",
  webDomain: "auth-hnnt-app-dev.auth.us-west-2.amazoncognito.com",
  providers: ["FACEBOOK", "GOOGLE"]
}
```

## Production Deployment

### 1. App Store Configuration
Ensure your app's URL scheme is configured:
```json
{
  "expo": {
    "scheme": "hnnt"
  }
}
```

### 2. Web Domain Setup
If using web authentication:
1. Set up SSL certificate for `www.hnnt.app`
2. Configure `/auth/callback/` endpoint
3. Add domain to Cognito's allowed URLs

### 3. Environment Variables
Consider using environment variables for sensitive configuration:
```javascript
// In production build
const config = {
  OAuth: {
    WebDomain: process.env.COGNITO_DOMAIN,
    AppClientId: process.env.COGNITO_CLIENT_ID,
    SignInRedirectURI: process.env.OAUTH_REDIRECT_URI
  }
};
```

## Troubleshooting

### Common Errors

**"Auth UserPool not configured"**
- Solution: Check if your IP is in Cognito's allowed URLs
- Development: Use the dev bypass option for testing

**"redirect_uri_mismatch"**
- Solution: Ensure the redirect URI exactly matches what's configured in Cognito
- Check for trailing slashes and protocol (exp:// vs https://)

**"Invalid client_id"**
- Solution: Verify the App Client ID matches in both Cognito and your config

### Debug Steps
1. Check console logs for current redirect URI
2. Verify IP address matches your development server
3. Test dev bypass authentication first
4. Gradually test OAuth providers

## Security Considerations

### Development
- ✅ Use dev bypass only in development builds
- ✅ Restrict development URLs to local networks
- ✅ Never commit OAuth secrets to version control

### Production
- ✅ Use environment variables for sensitive configuration
- ✅ Implement proper error handling
- ✅ Monitor OAuth failures and abuse
- ✅ Regular security audits of OAuth configuration

## Next Steps

1. **Test the current setup** with the new dynamic configuration
2. **Verify each OAuth provider** works correctly
3. **Update package dependencies** to resolve version warnings
4. **Create automated tests** for OAuth flows
5. **Document deployment process** for production

---

*Last updated: $(date)*
*Configuration version: 2.0 (Dynamic OAuth URIs)*