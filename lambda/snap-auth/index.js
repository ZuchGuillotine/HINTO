const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminInitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const axios = require('axios');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-west-2' });
const ssmClient = new SSMClient({ region: 'us-west-2' });

// Cognito User Pool ID
const USER_POOL_ID = 'us-west-2_G1vzYe7Fm';
const CLIENT_ID = 'YOUR_COGNITO_CLIENT_ID'; // We'll need to get this from Cognito

// Snap OAuth endpoints
const SNAP_AUTH_URL = 'https://accounts.snapchat.com/accounts/oauth2/auth';
const SNAP_TOKEN_URL = 'https://accounts.snapchat.com/accounts/oauth2/token';
const SNAP_USER_INFO_URL = 'https://kit.snapchat.com/v1/me';

// Get Snap credentials from SSM Parameter Store
async function getSnapCredentials() {
    const clientId = await ssmClient.send(new GetParameterCommand({
        Name: '/hinto/snap/client_id',
        WithDecryption: true
    }));
    const clientSecret = await ssmClient.send(new GetParameterCommand({
        Name: '/hinto/snap/client_secret',
        WithDecryption: true
    }));
    return {
        clientId: clientId.Parameter.Value,
        clientSecret: clientSecret.Parameter.Value
    };
}

// Generate a random state for OAuth security
function generateState() {
    return Math.random().toString(36).substring(2, 15);
}

// Handle the OAuth initiation
async function handleInit(event) {
    const state = generateState();
    const { clientId } = await getSnapCredentials();
    
    const authUrl = new URL(SNAP_AUTH_URL);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', 'YOUR_REDIRECT_URI'); // We'll need to set this
    authUrl.searchParams.append('scope', 'user.display_name user.bitmoji.avatar');
    authUrl.searchParams.append('state', state);
    
    return {
        statusCode: 302,
        headers: {
            'Location': authUrl.toString()
        }
    };
}

// Handle the OAuth callback
async function handleCallback(event) {
    const { code, state } = event.queryStringParameters || {};
    if (!code) {
        throw new Error('No authorization code provided');
    }

    // Exchange code for access token
    const { clientId, clientSecret } = await getSnapCredentials();
    const tokenResponse = await axios.post(SNAP_TOKEN_URL, {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'YOUR_REDIRECT_URI' // Same as in handleInit
    });

    // Get user info from Snap
    const userInfo = await axios.get(SNAP_USER_INFO_URL, {
        headers: {
            'Authorization': `Bearer ${tokenResponse.data.access_token}`
        }
    });

    // Create or update Cognito user
    const username = `snap_${userInfo.data.id}`;
    try {
        // Try to create the user
        await cognitoClient.send(new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            UserAttributes: [
                { Name: 'email', Value: userInfo.data.email || `${username}@snapchat.com` },
                { Name: 'name', Value: userInfo.data.display_name || username },
                { Name: 'picture', Value: userInfo.data.bitmoji_avatar_url || '' },
                { Name: 'custom:snap_id', Value: userInfo.data.id }
            ],
            MessageAction: 'SUPPRESS'
        }));

        // Set a random password (user will use social login)
        const tempPassword = Math.random().toString(36).slice(-8);
        await cognitoClient.send(new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            Password: tempPassword,
            Permanent: true
        }));
    } catch (error) {
        // If user already exists, that's fine
        if (error.name !== 'UsernameExistsException') {
            throw error;
        }
    }

    // Authenticate the user with Cognito
    const authResponse = await cognitoClient.send(new AdminInitiateAuthCommand({
        UserPoolId: USER_POOL_ID,
        ClientId: CLIENT_ID,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
            USERNAME: username,
            PASSWORD: tempPassword
        }
    }));

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            tokens: authResponse.AuthenticationResult
        })
    };
}

// Main Lambda handler
exports.handler = async (event) => {
    try {
        // Route based on the path
        const path = event.path || '';
        if (path.endsWith('/init')) {
            return await handleInit(event);
        } else if (path.endsWith('/callback')) {
            return await handleCallback(event);
        } else {
            throw new Error('Invalid path');
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: error.message
            })
        };
    }
}; 