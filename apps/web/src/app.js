import { api } from './api.js';
import { createApp } from './app-core.js';

const root = document.querySelector('#app');

if (!root) {
  throw new Error('Expected #app root element for the HINTO web shell.');
}

createApp({
  apiClient: api,
  root,
}).mount();
