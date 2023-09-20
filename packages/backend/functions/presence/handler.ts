import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;

type ConnectEvent = {
  clientId: string;
  eventType: "connected";
  timestamp: number;
};

type DisconnectEvent = {
  clientId: string;
  eventType: "disconnected";
  timestamp: number;
};

type UnknownEvent = {
  eventType: never;
};

type Event = ConnectEvent | DisconnectEvent | UnknownEvent;

export const handler = async (event: Event) => {
  const ddbDocClient = DynamoDBDocument.from(new DynamoDBClient({}));

  /**
   * These could be out of order.
   */
  if (event.eventType === "connected") {
    await ddbDocClient.put({
      TableName: DATA_TABLE_NAME,
      Item: {
        pk: "USER",
        sk: `USER#${event.clientId}`,
        status: "CONNECTED",
        userId: event.clientId,
      },
    });
  }

  if (event.eventType === "disconnected") {
    await ddbDocClient.update({
      TableName: DATA_TABLE_NAME,
      Key: { pk: "USER", sk: `USER#${event.clientId}` },
      ConditionExpression: "attribute_exists(#pk)",
      ExpressionAttributeNames: {
        "#status": "status",
        "#pk": "pk",
      },
      ExpressionAttributeValues: {
        ":connected": "CONNECTED",
      },
    });
  }
};
