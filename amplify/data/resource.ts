import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * HOSHUTARO Track D - User domain models (Sprint 1)
 *
 * Business data (equipment master, work orders, etc.) remains in local SQLite
 * (offline-first design). Only user-scoped settings and sync metadata live in
 * the cloud, and every model uses `allow.owner()` so users can only access
 * their own records.
 *
 * See: docs/6_FRONTEND_BACKEND_INTEGRATION.md, docs/7_AUTH_AND_USERS.md
 */
const schema = a.schema({
  UserSettings: a
    .model({
      userId: a.id().required(),
      email: a.email().required(),
      theme: a.enum(['light', 'dark']),
      language: a.enum(['ja', 'en']),
      mfaEnabled: a.boolean().default(false),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .identifier(['userId'])
    .authorization((allow) => [allow.owner()]),

  LLMSettings: a
    .model({
      userId: a.id().required(),
      preferredModel: a.string(),
      fallbackModels: a.string().array(),
      mtpEnabled: a.boolean().default(false),
      customApiKeys: a.string(),
    })
    .identifier(['userId'])
    .authorization((allow) => [allow.owner()]),

  SyncMetadata: a
    .model({
      userId: a.id().required(),
      deviceId: a.string().required(),
      deviceName: a.string(),
      lastSyncedAt: a.datetime(),
      syncVersion: a.integer().default(0),
    })
    .identifier(['userId', 'deviceId'])
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
