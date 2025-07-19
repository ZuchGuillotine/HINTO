/**
 * Amplify v6 configuration for authentication
 */

/**
 * Get the Amplify v6 configuration based on AWS Cognito settings
 * @returns Amplify configuration 
 */
export const getAmplifyConfig = () => {
  // Standard Amplify v6 configuration format
  const config = {
    Auth: {
      Cognito: {
        userPoolId: 'us-west-2_G1vzYe7Fm',
        userPoolClientId: '59birgscfcc9lguiq3765tcumk',
        identityPoolId: 'us-west-2:699a544e-d0fd-47e6-89ba-60d693a90f78',
        loginWith: {
          username: true,
          email: true
        }
      }
    }
  };
  
  if (__DEV__) {
    console.log('🔧 Amplify v6 Configuration:', {
      userPoolId: config.Auth.Cognito.userPoolId,
      clientId: config.Auth.Cognito.userPoolClientId,
      loginWith: config.Auth.Cognito.loginWith
    });
  }
  
  return config;
};

export default getAmplifyConfig;