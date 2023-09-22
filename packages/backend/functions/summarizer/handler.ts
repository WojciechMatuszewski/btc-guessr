import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBStreamHandler, StreamRecord } from "aws-lambda";
import { GameEntity, GameResultItem } from "../../entity/game";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { PredictionEntity } from "../../entity/prediction";
import { UserEntity } from "../../entity/user";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

const predictionEntity = new PredictionEntity(DATA_TABLE_NAME, client);
const gameEntity = new GameEntity(DATA_TABLE_NAME, client);
const userEntity = new UserEntity(DATA_TABLE_NAME, client);

export const handler: DynamoDBStreamHandler = async (event) => {
  const gameResultItems = event.Records.filter(
    (event): event is { dynamodb: { NewImage: StreamRecord["NewImage"] } } => {
      return event.dynamodb?.NewImage != null;
    }
  )
    .map((eventWithNewImage) => {
      return unmarshall(
        eventWithNewImage.dynamodb.NewImage as Record<string, AttributeValue>
      );
    })
    .filter((newImageItem): newImageItem is GameResultItem => {
      return GameEntity.isGameResultItem(newImageItem);
    });

  const operations = gameResultItems.map(async (gameResult) => {
    const scoresForGame = await gameEntity.calculateScoresForGame({
      id: gameResult.gameId,
      predictionEntity,
    });
    return userEntity.updateUsersScore({ scores: scoresForGame });
  });

  await Promise.all(operations);
};
