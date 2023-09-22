import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { is, number, object } from "valibot";
import wretch from "wretch";
import { DEFAULT_GAME_ROOM, GameEntity } from "../../entity/game";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

export const handler = async () => {
  const gameEntity = new GameEntity(DATA_TABLE_NAME, client);

  await gameEntity.newGameItem({
    value: await getGameValue(),
    room: DEFAULT_GAME_ROOM,
  });
};

const RatesSchema = object({
  rates: object({
    usd: object({
      value: number(),
    }),
  }),
});

const COINGECKO_API = "https://api.coingecko.com/api/v3/exchange_rates";
const getGameValue = async () => {
  const btcValue = await wretch(COINGECKO_API).get().json();
  if (!is(RatesSchema, btcValue)) {
    return Math.random();
  }
  return btcValue.rates.usd.value;
};
