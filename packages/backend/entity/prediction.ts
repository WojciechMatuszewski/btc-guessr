import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  Output,
  literal,
  merge,
  object,
  startsWith,
  string,
  union,
} from "valibot";
import { GameEntity } from "./game";
import { UserEntity } from "./user";

const PredictionKeySchema = object({
  pk: string([startsWith("GAME#")]),
  sk: string([startsWith("PREDICTION#")]),
});
type PredictionKey = Output<typeof PredictionKeySchema>;

const PredictionAttributesSchema = object({
  prediction: union([literal("UP"), literal("DOWN")]),
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
      prediction,
    };

    await this.client.transactWrite({
      TransactItems: [
        {
          ConditionCheck: {
            TableName: this.tableName,
            ConditionExpression: "attribute_exists(#pk)",
            ExpressionAttributeNames: {
              "#pk": "pk",
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
}
