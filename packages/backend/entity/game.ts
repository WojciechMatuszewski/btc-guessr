import {
  DynamoDBDocument,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Game } from "@btc-guessr/transport";
import { ulid } from "ulidx";
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

const GameKeySchema = object({
  pk: literal("GAME"),
  sk: string([startsWith("GAME#ROOM#")]),
});
type GameKey = Output<typeof GameKeySchema>;

const GameAttributesSchema = object({
  id: string(),
  value: number(),
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

  async newGameItem(
    { room }: { room: string } = { room: "default" }
  ): Promise<GameItem> {
    const currentGame = await this.getGameItem({ room });

    const newGameValue = Math.random();
    const newGameId = ulid();
    const newGameKey = GameEntity.gameKey({ room });

    const transactionItems: TransactWriteCommandInput["TransactItems"] = [];
    transactionItems.push({
      Update: {
        TableName: this.tableName,
        Key: newGameKey,
        UpdateExpression: "SET #id = :id, #value = :value",
        ExpressionAttributeNames: {
          "#id": "id",
          "#value": "value",
        },
        ExpressionAttributeValues: {
          ":id": newGameId,
          ":value": newGameValue,
        },
      },
    });
    if (currentGame) {
      transactionItems.push({
        Put: {
          TableName: this.tableName,
          Item: this.computeGameResultItem({
            gameItem: currentGame,
            newValue: newGameValue,
          }),
          ConditionExpression: "attribute_not_exists(#pk)",
          ExpressionAttributeNames: {
            "#pk": "pk",
          },
        },
      });
    }

    await this.client.transactWrite({
      TransactItems: transactionItems,
    });

    const newGame: GameItem = {
      ...newGameKey,
      value: newGameValue,
      id: newGameId,
    };

    return newGame;
  }

  async getGameItem(
    { room }: { room: string } = { room: "default" }
  ): Promise<GameItem | null> {
    /**
     * So that we have something to start with.
     * We could seed the database
     */
    const { Item } = await this.client.get({
      TableName: this.tableName,
      Key: GameEntity.gameKey({ room }),
    });
    if (!Item) {
      return null;
    }

    if (!is(GameItemSchema, Item)) {
      throw new Error("Malformed game data");
    }

    return Item;
  }

  private computeGameResultItem({
    gameItem,
    newValue,
  }: {
    gameItem: GameItem;
    newValue: number;
  }): GameResultItem {
    const difference = gameItem.value - newValue;
    const correctPrediction: GameResultItem["correctPrediction"] =
      difference < 0 ? "DOWN" : "UP";

    const gameResult: GameResultItem = {
      ...GameEntity.gameResultKey({ id: gameItem.id }),
      previousValue: gameItem.value,
      currentValue: newValue,
      correctPrediction,
      difference,
    };

    return gameResult;
  }

  static gameKey({ room }: { room: string }): GameKey {
    return { pk: "GAME", sk: `GAME#ROOM#${room}` };
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

  static toGame(gameItem: GameItem): Game {
    return {
      room: gameItem.sk.replace("GAME#ROOM#", ""),
      id: gameItem.id,
      value: gameItem.value,
    };
  }

  static isGameItemChange(payload: {
    oldItem: unknown;
    newItem: unknown;
  }): payload is { oldItem: GameItem; newItem: GameItem } {
    const { oldItem, newItem } = payload;

    if (!is(GameItemSchema, oldItem)) {
      return false;
    }

    if (!is(GameItemSchema, newItem)) {
      return false;
    }

    return oldItem.id !== newItem.id;
  }
}
