import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { GameEntity } from "../../entity/game";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

export const handler = async () => {
  const gameEntity = new GameEntity(DATA_TABLE_NAME, client);
  await gameEntity.newGame();
};
