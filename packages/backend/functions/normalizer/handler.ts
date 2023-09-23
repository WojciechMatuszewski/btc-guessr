import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  GameEvent,
  PredictionEvent,
  PresenceEvent,
  User,
} from "@btc-guessr/transport";
import { DynamoDBRecord } from "aws-lambda";
import { UserEntity } from "../../entity/user";
import { PredictionEntity } from "../../entity/prediction";
import { DEFAULT_GAME_ROOM, GameEntity } from "../../entity/game";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

const predictionEntity = new PredictionEntity(DATA_TABLE_NAME, client);
const gameEntity = new GameEntity(DATA_TABLE_NAME, client);

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
   * To make type-guards work.
   * TypeScript is not smart enough to deduce the types when we pass {oldItem, newItem} into the functions.
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
    /**
     * Users from different rooms are test users
     */
    if (
      dataChangePayload.newItem.room &&
      dataChangePayload.newItem.room !== DEFAULT_GAME_ROOM
    ) {
      return;
    }

    const user = UserEntity.toUser(dataChangePayload.newItem);
    const predictionForUser = await getPredictionForUser({ user });

    const event: PresenceEvent = {
      payload: {
        ...UserEntity.toUser(dataChangePayload.newItem),
        prediction: predictionForUser,
      },
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

const getPredictionForUser = async ({ user }: { user: User }) => {
  const currentGameItem = await gameEntity.getGameItem({
    room: DEFAULT_GAME_ROOM,
  });
  if (!currentGameItem) {
    return null;
  }

  const userPredictionForGame = await predictionEntity.getPredictionItemForUser(
    {
      gameId: currentGameItem.id,
      userId: user.id,
    }
  );
  if (!userPredictionForGame?.prediction) {
    return null;
  }

  return userPredictionForGame.prediction;
};
