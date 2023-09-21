import { APIGatewayProxyHandler } from "aws-lambda";

export const handler: APIGatewayProxyHandler = async () => {
  /**
   * 1. fetch the game
   * 2. fetch the votes
   * 3. fetch the active users
   *
   * 4. merge votes with active users
   */
  return { statusCode: 200, body: "{}" };
};
