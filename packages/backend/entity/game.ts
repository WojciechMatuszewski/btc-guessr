import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  Output,
  is,
  literal,
  merge,
  number,
  object,
  startsWith,
  string,
  union,
} from "valibot";
import { ulid } from "ulidx";

const GameKeySchema = object({
  pk: literal("GAME"),
  sk: literal("GAME"),
});
type GameKey = Output<typeof GameKeySchema>;

const GameAttributesSchema = object({
  id: string(),
  previousValue: number(),
});

const GameItemSchema = merge([GameKeySchema, GameAttributesSchema]);
type GameItem = Output<typeof GameItemSchema>;

const GameResultKeySchema = object({
  pk: string([startsWith("GAME#")]),
  sk: string([startsWith("RESULT")]),
});
type GameResultKey = Output<typeof GameResultKeySchema>;

const GameResultAttributesSchema = object({
  previousValue: number(),
  currentValue: number(),
  difference: number(),
  correctPrediction: union([literal("UP"), literal("DOWN")]),
});

const GameResultSchema = merge([
  GameResultKeySchema,
  GameResultAttributesSchema,
]);
type GameResultItem = Output<typeof GameResultSchema>;

export class GameEntity {
  constructor(
    private tableName: string,
    private client: DynamoDBDocument
  ) {}

  async newGame(): Promise<GameItem> {
    const currentGame = await this.getGame();

    const nextValue = Math.random();
    const difference = currentGame.previousValue - nextValue;
    const correctPrediction: GameResultItem["correctPrediction"] =
      difference < 0 ? "DOWN" : "UP";

    const newGameId = ulid();

    const gameResult: GameResultItem = {
      ...GameEntity.gameResultKey({ id: currentGame.id }),
      previousValue: currentGame.previousValue,
      currentValue: nextValue,
      correctPrediction,
      difference,
    };

    await this.client.transactWrite({
      TransactItems: [
        {
          Update: {
            TableName: this.tableName,
            Key: GameEntity.gameKey(),
            UpdateExpression: "SET #id = :id, #previousValue = :previousValue",
            ExpressionAttributeNames: {
              "#id": "id",
              "#previousValue": "previousValue",
            },
            ExpressionAttributeValues: {
              ":id": newGameId,
              ":previousValue": nextValue,
            },
          },
        },
        {
          Put: {
            TableName: this.tableName,
            Item: gameResult,
            ConditionExpression: "attribute_not_exists(#pk)",
            ExpressionAttributeNames: {
              "#pk": "pk",
            },
          },
        },
      ],
    });

    const newGame: GameItem = {
      ...currentGame,
      previousValue: nextValue,
      id: newGameId,
    };

    return newGame;
  }

  async getGame(): Promise<GameItem> {
    /**
     * So that we have something to start with.
     * We could seed the database
     */
    const { Item = DEFAULT_GAME } = await this.client.get({
      TableName: this.tableName,
      Key: GameEntity.gameKey(),
    });

    if (!is(GameItemSchema, Item)) {
      throw new Error("Malformed game data");
    }

    return Item;
  }

  static gameKey(): GameKey {
    return { pk: "GAME", sk: "GAME" };
  }

  static isGameItem(data: unknown): data is GameItem {
    return is(GameItemSchema, data);
  }

  static gameResultKey({ id }: { id: string }): GameResultKey {
    return {
      pk: `GAME#${id}`,
      sk: "RESULT",
    };
  }
}

const DEFAULT_GAME: GameItem = {
  id: ulid(),
  pk: "GAME",
  previousValue: 0,
  sk: "GAME",
};
