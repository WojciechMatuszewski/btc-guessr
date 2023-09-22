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
import { PredictionEntity } from "./prediction";

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
  gameId: string(),
});

const GameResultSchema = merge([
  GameResultKeySchema,
  GameResultAttributesSchema,
]);
export type GameResultItem = Output<typeof GameResultSchema>;

export const DEFAULT_GAME_ROOM = "default";

export class GameEntity {
  constructor(
    private tableName: string,
    private client: DynamoDBDocument
  ) {}

  async newGameItem({
    room,
    value,
  }: {
    room: string;
    value: number;
  }): Promise<GameItem> {
    const currentGame = await this.getGameItem({ room });

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
          ":value": value,
        },
      },
    });
    if (currentGame) {
      transactionItems.push({
        Put: {
          TableName: this.tableName,
          Item: this.computeGameResultItem({
            gameItem: currentGame,
            newValue: value,
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
      value,
      id: newGameId,
    };

    return newGame;
  }

  async getGameItem(
    { room }: { room: string } = { room: DEFAULT_GAME_ROOM }
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

  async getGameResultItem({
    id,
  }: {
    id: string;
  }): Promise<GameResultItem | null> {
    const { Item } = await this.client.get({
      TableName: this.tableName,
      Key: GameEntity.gameResultKey({ id }),
    });
    if (!Item) {
      return null;
    }

    if (!is(GameResultSchema, Item)) {
      throw new Error("Malformed data");
    }

    return Item;
  }

  async calculateScoresForGame({
    id,
    predictionEntity,
  }: {
    id: string;
    predictionEntity: PredictionEntity;
  }): Promise<Record<string, 1 | -1>> {
    /**
     * Optimization: we could use a single query here instead.
     */
    const [gameResultItem, gamePredictionItems] = await Promise.all([
      await this.getGameResultItem({ id }),
      await predictionEntity.getPredictionItems({ gameId: id }),
    ]);
    if (!gameResultItem) {
      return {};
    }

    const scoresForGame = gamePredictionItems.reduce(
      (scores, prediction) => {
        scores[prediction.userId] =
          gameResultItem.correctPrediction === prediction.prediction ? 1 : -1;
        return scores;
      },
      {} as Record<string, 1 | -1>
    );

    return scoresForGame;
  }

  private computeGameResultItem({
    gameItem,
    newValue,
  }: {
    gameItem: GameItem;
    newValue: number;
  }): GameResultItem {
    const difference = newValue - gameItem.value;
    const correctPrediction: GameResultItem["correctPrediction"] =
      difference < 0 ? "DOWN" : "UP";

    const gameResult: GameResultItem = {
      ...GameEntity.gameResultKey({ id: gameItem.id }),
      gameId: gameItem.id,
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

  static isGameResultItem(data: unknown): data is GameResultItem {
    return is(GameResultSchema, data);
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
