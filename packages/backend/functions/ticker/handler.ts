import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;

export const handler = async () => {
  const ddbDocClient = DynamoDBDocument.from(new DynamoDBClient({}));

  const now = Date.now();
  await ddbDocClient.put({
    TableName: DATA_TABLE_NAME,
    Item: {
      pk: `GAME#${now}`,
      sk: `TICKER`,
      value: Math.random(),
    },
  });
};
