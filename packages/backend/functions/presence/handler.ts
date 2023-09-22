import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { array, includes, is, literal, number, object, string } from "valibot";
import { DEFAULT_GAME_ROOM } from "../../entity/game";
import { UserEntity } from "../../entity/user";
import { DisconnectionEvent } from "@btc-guessr/transport";

const SubscribeEventSchema = object({
  clientId: string(),
  eventType: literal("subscribed"),
  topics: array(string([includes("game")])),
  timestamp: number(),
});

const UnsubscribeEventSchema = object({
  clientId: string(),
  eventType: literal("unsubscribed"),
  topics: array(string([includes("game")])),
  timestamp: number(),
});

const DisconnectedEventSchema = object({
  clientId: string(),
  eventType: literal("disconnected"),
  timestamp: number(),
});

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const dynamoDbClient = DynamoDBDocument.from(new DynamoDBClient({}));

const sqsClient = new SQSClient({});
const DISCONNECTIONS_QUEUE_URL = process.env[
  "DISCONNECTIONS_QUEUE_URL"
] as string;

export const handler = async (event: unknown) => {
  const userEntity = new UserEntity(DATA_TABLE_NAME, dynamoDbClient);

  if (is(SubscribeEventSchema, event)) {
    await userEntity.userConnected({
      id: event.clientId,
      room: DEFAULT_GAME_ROOM,
      timestampMs: event.timestamp,
    });

    return;
  }

  /**
   * When the user closes the browser, the "unsubscribed" event is not fired.
   * Instead we should listen to the "disconnected event"
   */
  if (is(UnsubscribeEventSchema, event) || is(DisconnectedEventSchema, event)) {
    const eventToSent: DisconnectionEvent = {
      type: "disconnection",
      payload: { timestampMs: event.timestamp, userId: event.clientId },
    };

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: DISCONNECTIONS_QUEUE_URL,
        MessageBody: JSON.stringify(eventToSent),
        DelaySeconds: 5,
      })
    );
  }

  console.warn("Unknown event", event);
};
