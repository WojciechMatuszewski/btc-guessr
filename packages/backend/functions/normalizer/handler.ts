import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  GameEvent,
  PredictionEvent,
  PresenceEvent,
} from "@btc-guessr/transport";
import { DynamoDBRecord } from "aws-lambda";
import { UserEntity } from "../../entity/user";
import { PredictionEntity } from "../../entity/prediction";
import { GameEntity } from "../../entity/game";

// eslint-disable-next-line @typescript-eslint/require-await
export const handler = async (event: DynamoDBRecord[]) => {
  const [record] = event;
  if (!record?.dynamodb) {
    throw new Error("Malformed data");
  }

  const { NewImage, OldImage } = record.dynamodb;

  const oldItem = OldImage
    ? unmarshall(OldImage as Record<string, AttributeValue>)
    : null;

  const newItem = NewImage
    ? unmarshall(NewImage as Record<string, AttributeValue>)
    : null;
  /**
   * To make type-guards work
   */
  const dataChangePayload = { oldItem, newItem };

  if (PredictionEntity.isNewPredictionItem(dataChangePayload)) {
    const event: PredictionEvent = {
      payload: PredictionEntity.toPrediction(dataChangePayload.newItem),
      type: "prediction",
    };

    return event;
  }

  if (UserEntity.isUserItemPresenceChange(dataChangePayload)) {
    const event: PresenceEvent = {
      payload: UserEntity.toUser(dataChangePayload.newItem),
      type: "presence",
    };

    return event;
  }

  if (GameEntity.isGameItemChange(dataChangePayload)) {
    const event: GameEvent = {
      payload: GameEntity.toGame(dataChangePayload.newItem),
      type: "game",
    };

    return event;
  }

  return null;
};
