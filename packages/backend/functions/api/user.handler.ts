import { APIGatewayProxyHandler } from "aws-lambda";
import { object, safeParse, string } from "valibot";
import { UserEntity, UserNotFoundError } from "../../entity/user";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import httpCors from "@middy/http-cors";

const PathParametersSchema = object({
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

  const userEntity = new UserEntity(DATA_TABLE_NAME, client);
  try {
    const userItem = await userEntity.getUserItem({
      id: pathParametersParseResult.output.userId,
    });
    const user = UserEntity.toUser(userItem);

    return { statusCode: 200, body: JSON.stringify(user) };
  } catch (e) {
    if (e instanceof UserNotFoundError) {
      return { statusCode: 404, body: JSON.stringify({ message: e.message }) };
    }

    return { statusCode: 500, body: JSON.stringify({ message: e }) };
  }
};

export const handler = middy(lambdaHandler).use(httpCors());
