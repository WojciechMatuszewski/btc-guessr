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
    room,
    userId,
    prediction,
  }: {
    gameId: string;
    room: string;
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
            ConditionExpression: "attribute_exists(#pk) AND #id = :gameId",
            ExpressionAttributeNames: {
              "#pk": "pk",
              "#id": "id",
            },
            ExpressionAttributeValues: {
              ":gameId": gameId,
            },
            Key: GameEntity.gameKey({ room }),
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
    const predictionsKey = PredictionEntity.predictionsKey({ gameId });

    const { Items = [] } = await this.client.query({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(#sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": predictionsKey.pk,
        ":sk": predictionsKey.sk,
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

  async getPredictionItemForUser({
    gameId,
    userId,
  }: {
    gameId: string;
    userId: string;
  }): Promise<PredictionItem | null> {
    const { Item } = await this.client.get({
      TableName: this.tableName,
      Key: PredictionEntity.predictionKey({ gameId, userId }),
    });
    if (!Item) {
      return null;
    }

    if (!is(PredictionItemSchema, Item)) {
      throw new Error("Malformed data");
    }

    return Item;
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

  static predictionsKey({ gameId }: { gameId: string }): PredictionKey {
    return {
      pk: `GAME#${gameId}`,
      sk: `PREDICTION#`,
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
