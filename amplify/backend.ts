import { defineBackend } from '@aws-amplify/backend';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmationTrigger } from './functions/post-confirmation-trigger/resource';

const backend = defineBackend({
  auth,
  data,
  postConfirmationTrigger,
});

const { cfnUserPool } = backend.auth.resources.cfnResources;

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
const lambdaFunction = backend.postConfirmationTrigger.resources.lambda as LambdaFunction;

lambdaFunction.addEnvironment('USER_SETTINGS_TABLE', userSettingsTable.tableName);
userSettingsTable.grantWriteData(lambdaFunction);
