import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  Output,
  is,
  literal,
  merge,
  object,
  parse,
  startsWith,
  string,
  union,
} from "valibot";
import { GameEntity } from "./game";
import { UserEntity } from "./user";
import { Prediction } from "@btc-guessr/transport";

const PredictionKeySchema = object({
  pk: string([startsWith("GAME#")]),
  sk: string([startsWith("PREDICTION#")]),
});
type PredictionKey = Output<typeof PredictionKeySchema>;

const PredictionAttributesSchema = object({
  prediction: union([literal("UP"), literal("DOWN")]),
  gameId: string(),
  userId: string(),
});

const PredictionItemSchema = merge([
  PredictionKeySchema,
  PredictionAttributesSchema,
]);
type PredictionItem = Output<typeof PredictionItemSchema>;

export class PredictionEntity {
  constructor(
    private tableName: string,
    private client: DynamoDBDocument
  ) {}

  async predict({
    gameId,
    userId,
    prediction,
  }: {
    gameId: string;
    userId: string;
    prediction: PredictionItem["prediction"];
  }) {
    const predictionItem: PredictionItem = {
      ...PredictionEntity.predictionKey({ gameId, userId }),
      gameId,
      userId,
      prediction,
    };

    await this.client.transactWrite({
      TransactItems: [
        {
          ConditionCheck: {
            TableName: this.tableName,
            ConditionExpression: "attribute_exists(#pk) AND #gameId = :gameId",
            ExpressionAttributeNames: {
              "#pk": "pk",
              "#gameId": "#gameId",
            },
            Key: GameEntity.gameKey(),
          },
        },
        {
          ConditionCheck: {
            TableName: this.tableName,
            ConditionExpression: "attribute_exists(#pk)",
            ExpressionAttributeNames: {
              "#pk": "pk",
            },
            Key: UserEntity.userKey({ id: userId }),
          },
        },
        {
          Put: {
            TableName: this.tableName,
            Item: predictionItem,
          },
        },
      ],
    });
  }

  async getPredictionItems({
    gameId,
  }: {
    gameId: string;
  }): Promise<PredictionItem[]> {
    const { Items = [] } = await this.client.query({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(#sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `GAME#${gameId}`,
        ":sk": "PREDICTION#",
      },
      ExpressionAttributeNames: {
        "#sk": "sk",
      },
    });

    const validatedPredictions = Items.map((prediction) => {
      return parse(PredictionItemSchema, prediction);
    });

    return validatedPredictions;
  }

  static predictionKey({
    userId,
    gameId,
  }: {
    userId: string;
    gameId: string;
  }): PredictionKey {
    return {
      pk: `GAME#${gameId}`,
      sk: `PREDICTION#${userId}`,
    };
  }

  static toPrediction(predictionItem: PredictionItem): Prediction {
    return {
      gameId: predictionItem.gameId,
      prediction: predictionItem.prediction,
      userId: predictionItem.userId,
    };
  }

  static isNewPredictionItem(payload: {
    oldItem: unknown;
    newItem: unknown;
  }): payload is { oldItem: unknown; newItem: PredictionItem } {
    const { oldItem, newItem } = payload;

    if (oldItem) {
      return false;
    }

    return is(PredictionItemSchema, newItem);
  }
}
