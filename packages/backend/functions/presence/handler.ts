import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UserEntity } from "../../entity/user";
import { array, includes, is, literal, object, string } from "valibot";
import { DEFAULT_GAME_ROOM } from "../../entity/game";

const SubscribeEventSchema = object({
  clientId: string(),
  eventType: literal("subscribed"),
  topics: array(string([includes("game")])),
});

const UnsubscribeEventSchema = object({
  clientId: string(),
  eventType: literal("unsubscribed"),
  topics: array(string([includes("game")])),
});

const DisconnectedEventSchema = object({
  clientId: string(),
  eventType: literal("disconnected"),
});

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

export const handler = async (event: unknown) => {
  const userEntity = new UserEntity(DATA_TABLE_NAME, client);

  console.log("event", event);

  if (is(SubscribeEventSchema, event)) {
    await userEntity.userConnected({
      id: event.clientId,
      room: DEFAULT_GAME_ROOM,
    });

    return;
  }

  /**
   * When the user closes the browser, the "unsubscribed" event is not fired.
   * Instead we should listen to the "disconnected event"
   */
  if (is(UnsubscribeEventSchema, event) || is(DisconnectedEventSchema, event)) {
    await userEntity.userDisconnected({
      id: event.clientId,
    });
    return;
  }

  console.warn("Unknown event", event);
};
