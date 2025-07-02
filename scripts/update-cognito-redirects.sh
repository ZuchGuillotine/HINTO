#!/bin/bash

# Update Cognito User Pool Client with Expo redirect URIs
# Run this script with AWS credentials that have Cognito permissions

USER_POOL_ID="us-west-2_G1vzYe7Fm"
CLIENT_ID="59birgscfcc9lguiq3765tcumk"
REGION="us-west-2"

echo "Updating Cognito User Pool Client redirect URIs..."

# First, get the current configuration
echo "Getting current configuration..."
CURRENT_CONFIG=$(aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --region $REGION \
  --output json)

if [ $? -ne 0 ]; then
  echo "Error: Failed to get current configuration. Make sure you have proper AWS permissions."
  echo "Required permission: cognito-idp:DescribeUserPoolClient"
  exit 1
fi

# Extract current redirect URIs and add Expo URIs
echo "Updating redirect URIs..."
aws cognito-idp update-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --region $REGION \
  --callback-urls "hnnt://" "https://www.hnnt.app/auth/callback/" "exp://127.0.0.1:19000/" "exp://localhost:19000/" \
  --logout-urls "hnnt://" "https://www.hnnt.app/auth/signout/" "exp://127.0.0.1:19000/" "exp://localhost:19000/" \
  --supported-identity-providers "COGNITO" "Google" "Facebook" \
  --allowed-o-auth-flows "code" \
  --allowed-o-auth-scopes "phone" "email" "openid" "profile" "aws.cognito.signin.user.admin" \
  --allowed-o-auth-flows-user-pool-client

if [ $? -eq 0 ]; then
  echo "✅ Successfully updated Cognito User Pool Client!"
  echo "Added redirect URIs:"
  echo "  - exp://127.0.0.1:19000/"
  echo "  - exp://localhost:19000/"
  echo ""
  echo "You can now test OAuth flows in Expo Go."
else
  echo "❌ Failed to update Cognito User Pool Client."
  echo "Make sure you have the following permissions:"
  echo "  - cognito-idp:UpdateUserPoolClient"
  echo "  - cognito-idp:DescribeUserPoolClient"
fi