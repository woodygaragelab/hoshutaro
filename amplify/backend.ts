import { defineBackend } from '@aws-amplify/backend';
import {
  Function as LambdaFunction,
  FunctionUrlAuthType,
  InvokeMode,
} from 'aws-cdk-lib/aws-lambda';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmationTrigger } from './functions/post-confirmation-trigger/resource';
import { llmProxy } from './functions/llm-proxy/resource';
import { userManagement } from './functions/user-management/resource';

const backend = defineBackend({
  auth,
  data,
  postConfirmationTrigger,
  llmProxy,
  userManagement,
});

const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;

cfnUserPool.policies = {
  passwordPolicy: {
    minimumLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
  },
};

cfnUserPool.mfaConfiguration = 'OPTIONAL';
cfnUserPool.enabledMfas = ['SOFTWARE_TOKEN_MFA'];

const userSettingsTable = backend.data.resources.tables['UserSettings'];
const postConfirmLambda = backend.postConfirmationTrigger.resources.lambda as LambdaFunction;

postConfirmLambda.addEnvironment('USER_SETTINGS_TABLE', userSettingsTable.tableName);
userSettingsTable.grantWriteData(postConfirmLambda);

// ============================================================================
// Track D Sprint 3 - llm-proxy Lambda (Slice 3-A)
// ============================================================================

const llmProxyLambda = backend.llmProxy.resources.lambda as LambdaFunction;

// Cognito JWT verifier に必要な User Pool ID / App Client ID を env として注入
llmProxyLambda.addEnvironment('USER_POOL_ID', cfnUserPool.ref);
llmProxyLambda.addEnvironment('USER_POOL_CLIENT_ID', cfnUserPoolClient.ref);

// Bedrock Runtime API 呼出し権限 (Claude 3.5 Sonnet / Claude 3 Haiku 等)
llmProxyLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    // 全 foundation model にアクセス可能。本番では特定モデル ARN に絞り込み推奨
    resources: ['*'],
  }),
);

// ANTHROPIC_API_KEY は Secrets Manager 経由で注入する想定 (Sprint 4 で wiring)。
// 現状は Sandbox では Anthropic Direct fallback 無効、Bedrock のみで動作。

// Function URL: Response Streaming 有効、認証は Lambda 内 JWT 検証で扱うため NONE。
const llmProxyUrl = llmProxyLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  invokeMode: InvokeMode.RESPONSE_STREAM,
  cors: {
    allowedOrigins: ['*'], // 本番では特定ドメインに絞る
    allowedMethods: ['POST' as never, 'OPTIONS' as never],
    allowedHeaders: ['Authorization', 'Content-Type'],
  },
});

// フロントから利用するため、URL を CloudFormation Output として出力。
backend.addOutput({
  custom: {
    llmProxyUrl: llmProxyUrl.url,
  },
});

// ============================================================================
// Track D Sprint 4 - user-management Lambda (Slice 4-A)
// ============================================================================

const userManagementLambda = backend.userManagement.resources.lambda as LambdaFunction;

// 環境変数: Cognito 検証 + DynamoDB テーブル名
userManagementLambda.addEnvironment('USER_POOL_ID', cfnUserPool.ref);
userManagementLambda.addEnvironment('USER_POOL_CLIENT_ID', cfnUserPoolClient.ref);
userManagementLambda.addEnvironment('USER_SETTINGS_TABLE', userSettingsTable.tableName);

const llmSettingsTable = backend.data.resources.tables['LLMSettings'];
const syncMetadataTable = backend.data.resources.tables['SyncMetadata'];

userManagementLambda.addEnvironment('LLM_SETTINGS_TABLE', llmSettingsTable.tableName);
userManagementLambda.addEnvironment('SYNC_METADATA_TABLE', syncMetadataTable.tableName);

// Cognito AdminDeleteUser 権限
userManagementLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['cognito-idp:AdminDeleteUser'],
    resources: [cfnUserPool.attrArn],
  }),
);

// DynamoDB 3 テーブルへの読書削除権限
userSettingsTable.grantReadWriteData(userManagementLambda);
llmSettingsTable.grantReadWriteData(userManagementLambda);
syncMetadataTable.grantReadWriteData(userManagementLambda);

// Function URL: 認証は Lambda 内 JWT 検証で扱うため NONE。Streaming 不要なので buffered。
const userManagementUrl = userManagementLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'], // 本番では特定ドメインに絞る (Sprint 5)
    allowedMethods: ['POST' as never, 'OPTIONS' as never],
    allowedHeaders: ['Authorization', 'Content-Type'],
  },
});

backend.addOutput({
  custom: {
    userManagementUrl: userManagementUrl.url,
  },
});
