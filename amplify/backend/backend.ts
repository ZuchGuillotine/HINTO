import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { api } from './api/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  api,
  storage
});

export default backend; 