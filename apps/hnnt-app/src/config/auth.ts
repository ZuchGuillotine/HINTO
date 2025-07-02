export const authConfig = {
  oauth: {
    domain: 'auth-hnnt-app-dev.auth.us-west-2.amazoncognito.com',
    scope: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
    redirectSignIn: __DEV__ ? 'exp://localhost:19000/' : 'https://www.hnnt.app/auth/callback/',
    redirectSignOut: __DEV__ ? 'exp://localhost:19000/' : 'https://www.hnnt.app/auth/signout/',
    responseType: 'code' as const,
  },
};