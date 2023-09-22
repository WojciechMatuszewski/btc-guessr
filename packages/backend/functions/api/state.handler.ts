import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { DEFAULT_GAME_ROOM, GameEntity } from "../../entity/game";
import { UserEntity } from "../../entity/user";
import { PredictionEntity } from "../../entity/prediction";
import middy from "@middy/core";
import httpCors from "@middy/http-cors";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

const lambdaHandler: APIGatewayProxyHandler = async () => {
  const gameEntity = new GameEntity(DATA_TABLE_NAME, client);
  const userEntity = new UserEntity(DATA_TABLE_NAME, client);
  const predictionEntity = new PredictionEntity(DATA_TABLE_NAME, client);

  const [gameItem, connectedUserItems] = await Promise.all([
    await gameEntity.getGameItem(),
    await userEntity.getConnectedUserItems({ room: DEFAULT_GAME_ROOM }),
  ]);
  if (!gameItem) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Game not found" }),
    };
  }

  const game = GameEntity.toGame(gameItem);
  const users = connectedUserItems.map((connectedUserItem) => {
    return UserEntity.toUser(connectedUserItem);
  });

  const predictionItemsForGame = await predictionEntity.getPredictionItems({
    gameId: gameItem.id,
  });
  const predictions = predictionItemsForGame.map((predictionItem) => {
    return PredictionEntity.toPrediction(predictionItem);
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      game,
      predictions,
      users,
    }),
  };
};

export const handler = middy(lambdaHandler).use(httpCors());
