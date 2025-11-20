import { createPinia } from 'pinia';

export const pinia = createPinia();

// Initialize any store setup here if needed
export const setupStores = () => {
  // Any store initialization logic can go here
};

export * from './auth';
