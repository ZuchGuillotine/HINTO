#!/bin/bash

# Create test user script for HNNT development
# Usage: ./scripts/create-test-user.sh [email] [password]

USER_POOL_ID="us-west-2_G1vzYe7Fm"
DEFAULT_EMAIL="testuser@example.com"
DEFAULT_PASSWORD="TempPass123!"

EMAIL=${1:-$DEFAULT_EMAIL}
PASSWORD=${2:-$DEFAULT_PASSWORD}

echo "Creating test user with email: $EMAIL"

# Create user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $EMAIL \
  --user-attributes Name=email,Value=$EMAIL Name=email_verified,Value=true \
  --temporary-password $PASSWORD \
  --message-action SUPPRESS \
  --region us-west-2

echo "User created. Setting permanent password..."

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $EMAIL \
  --password $PASSWORD \
  --permanent \
  --region us-west-2

echo "Test user created successfully!"
echo "Email: $EMAIL"
echo "Password: $PASSWORD"
echo "You can now sign in with these credentials in the app."