import { APIGatewayProxyHandler } from "aws-lambda";
import { literal, object, safeParse, string, union } from "valibot";
import { PredictionEntity } from "../../entity/prediction";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import httpCors from "@middy/http-cors";

const PathParametersSchema = object({
  gameId: string(),
});

const BodySchema = object({
  prediction: union([literal("UP"), literal("DOWN")]),
  userId: string(),
});

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

const lambdaHandler: APIGatewayProxyHandler = async (event) => {
  const pathParametersParseResult = safeParse(
    PathParametersSchema,
    event.pathParameters
  );
  if (!pathParametersParseResult.success) {
    const errorMessage = pathParametersParseResult.issues
      .map((issue) => issue.message)
      .join(",");

    return {
      statusCode: 403,
      body: JSON.stringify({ message: errorMessage }),
    };
  }

  const bodyParseResult = safeParse(BodySchema, JSON.parse(event.body ?? "{}"));
  if (!bodyParseResult.success) {
    const errorMessage = bodyParseResult.issues
      .map((issue) => issue.message)
      .join(",");

    return {
      statusCode: 403,
      body: JSON.stringify({ message: errorMessage }),
    };
  }

  const predictionEntity = new PredictionEntity(DATA_TABLE_NAME, client);
  await predictionEntity.predict({
    gameId: pathParametersParseResult.output.gameId,
    userId: bodyParseResult.output.userId,
    prediction: bodyParseResult.output.prediction,
    room: "default",
  });

  return { statusCode: 201, body: "{}" };
};

export const handler = middy(lambdaHandler).use(httpCors());
