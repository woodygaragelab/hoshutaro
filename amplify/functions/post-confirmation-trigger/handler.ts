import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const tableName = process.env.USER_SETTINGS_TABLE;
  if (!tableName) {
    throw new Error('USER_SETTINGS_TABLE environment variable is not set');
  }

  const { sub: userId, email } = event.request.userAttributes;
  if (!userId || !email) {
    throw new Error('Missing required Cognito user attributes (sub, email)');
  }

  const now = new Date().toISOString();

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        userId,
        email,
        theme: 'light',
        language: 'ja',
        mfaEnabled: false,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(userId)',
    }),
  );

  return event;
};
