import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DisconnectionEvent } from "@btc-guessr/transport";
import { isDisconnectionEvent } from "@btc-guessr/transport";
import { SQSHandler } from "aws-lambda";
import { UserEntity } from "../../entity/user";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const dynamoDbClient = DynamoDBDocument.from(new DynamoDBClient({}));

const userEntity = new UserEntity(DATA_TABLE_NAME, dynamoDbClient);

export const handler: SQSHandler = async (event) => {
  const disconnectionEvents = event.Records.reduce(
    (disconnectionEvents, event) => {
      const parsedEventBody: unknown = JSON.parse(event.body);
      if (isDisconnectionEvent(parsedEventBody)) {
        disconnectionEvents.push(parsedEventBody);
      }
      return disconnectionEvents;
    },
    [] as DisconnectionEvent[]
  );

  const operations = disconnectionEvents.map((event) => {
    return userEntity.userDisconnected({
      id: event.payload.userId,
      timestampMs: event.payload.timestampMs,
    });
  });

  /**
   * The operations can fail due to condition checks.
   * If the condition check fails, this means that, user re-connected during the DELIVERY_DELAY this message has.
   */
  await Promise.allSettled(operations);
};
