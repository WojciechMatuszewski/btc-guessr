import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulidx";
import { expect, test } from "vitest";
import { GameEntity } from "../game";
import { PredictionEntity } from "../prediction";
import { UserEntity } from "../user";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

test("fails when trying to make a prediction for a game that does not exist", async () => {
  const userEntity = new UserEntity(DATA_TABLE_NAME, client);
  const predictionEntity = new PredictionEntity(DATA_TABLE_NAME, client);

  const userId = ulid();
  await userEntity.upsertUser({
    id: userId,
    status: "CONNECTED",
  });

  await expect(
    predictionEntity.predict({
      gameId: "xx",
      room: "xx",
      userId,
      prediction: "DOWN",
    })
  ).rejects.toThrowError();
});

test("fails when trying to make a prediction with invalid user", async () => {
  const predictionEntity = new PredictionEntity(DATA_TABLE_NAME, client);
  const gameEntity = new GameEntity(DATA_TABLE_NAME, client);

  const roomId = ulid();
  const game = await gameEntity.newGameItem({ room: roomId });

  await expect(
    predictionEntity.predict({
      gameId: game.id,
      room: roomId,
      userId: "xx",
      prediction: "DOWN",
    })
  ).rejects.toThrowError();
});

test("succeeds when making a prediction for a valid game", async () => {
  const userEntity = new UserEntity(DATA_TABLE_NAME, client);
  const predictionEntity = new PredictionEntity(DATA_TABLE_NAME, client);
  const gameEntity = new GameEntity(DATA_TABLE_NAME, client);

  const userId = ulid();
  await userEntity.upsertUser({
    id: userId,
    status: "CONNECTED",
  });

  const roomId = ulid();
  const gameItem = await gameEntity.newGameItem({ room: roomId });

  await expect(
    predictionEntity.predict({
      gameId: gameItem.id,
      room: roomId,
      userId,
      prediction: "DOWN",
    })
  ).resolves.toEqual(undefined);
});
