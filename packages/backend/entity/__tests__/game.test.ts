import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulidx";
import { expect, test } from "vitest";
import { GameEntity } from "../game";
import pRetry from "p-retry";
import { UserEntity } from "../user";
import { PredictionEntity } from "../prediction";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

test(
  "creates a result item when a new game is created",
  async () => {
    const gameEntity = new GameEntity(DATA_TABLE_NAME, client);

    const roomId = ulid();
    const valueOfTheFirstGame = 1;

    const firstGameItem = await gameEntity.newGameItem({
      room: roomId,
      value: valueOfTheFirstGame,
    });

    /**
     * No results since there is no previous game for the game we have just created
     */
    await expect(
      gameEntity.getGameResultItem({ id: firstGameItem.id })
    ).resolves.toEqual(null);

    await gameEntity.newGameItem({
      room: roomId,
      value: 2,
    });

    /**
     * Now there is a result item, since we are playing a second game
     * This is read-after-write so we have to retry the assertion.
     * Otherwise test might get flaky due to eventual consistency.
     */
    await pRetry(
      async () => {
        await expect(
          gameEntity.getGameResultItem({ id: firstGameItem.id })
        ).resolves.toEqual(
          expect.objectContaining({
            currentValue: 2,
            correctPrediction: "UP",
            difference: 1,
          })
        );
      },
      { retries: 3 }
    );
  },
  { timeout: 15_000 }
);

test(
  "correctly calculates the scores for users who made a prediction",
  async () => {
    const gameEntity = new GameEntity(DATA_TABLE_NAME, client);
    const userEntity = new UserEntity(DATA_TABLE_NAME, client);
    const predictionEntity = new PredictionEntity(DATA_TABLE_NAME, client);

    const roomId = ulid();
    /**
     * Three users are playing the game.
     * Only two of them will make a prediction
     */
    const firstUserId = ulid();
    const secondUserId = ulid();
    const thirdUserId = ulid();

    await Promise.all([
      await userEntity.userConnected({ id: firstUserId, room: roomId }),
      await userEntity.userConnected({ id: secondUserId, room: roomId }),
      await userEntity.userConnected({ id: thirdUserId, room: roomId }),
    ]);

    const valueOfTheFirstGame = 1;
    const firstGameItem = await gameEntity.newGameItem({
      room: roomId,
      value: valueOfTheFirstGame,
    });

    /**
     * Users make their predictions
     */
    await predictionEntity.predict({
      gameId: firstGameItem.id,
      prediction: "DOWN",
      room: roomId,
      userId: firstUserId,
    });

    await predictionEntity.predict({
      gameId: firstGameItem.id,
      prediction: "UP",
      room: roomId,
      userId: secondUserId,
    });

    await gameEntity.newGameItem({
      room: roomId,
      value: 2,
    });

    await pRetry(async () => {
      await expect(
        gameEntity.calculateScoresForGame({
          id: firstGameItem.id,
          predictionEntity: predictionEntity,
        })
      ).resolves.toEqual({
        [firstUserId]: -1,
        [secondUserId]: 1,
      });
    });
  },
  { timeout: 30_000 }
);
