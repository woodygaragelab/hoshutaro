import { defineFunction } from '@aws-amplify/backend';

export const postConfirmationTrigger = defineFunction({
  name: 'post-confirmation-trigger',
  entry: './handler.ts',
});
