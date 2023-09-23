import {
  Output,
  literal,
  merge,
  number,
  object,
  string,
  union,
  nullable,
} from "valibot";

const predictionValueSchema = nullable(union([literal("UP"), literal("DOWN")]));

export const GameSchema = object({
  id: string(),
  value: number(),
  room: string(),
  createdAtMs: number(),
});
export type Game = Output<typeof GameSchema>;

export const UserSchema = object({
  id: string(),
  status: union([literal("CONNECTED"), literal("DISCONNECTED")]),
  name: string(),
  score: number(),
});
export type User = Output<typeof UserSchema>;

export const UserWithPredictionSchema = merge([
  UserSchema,
  object({
    prediction: predictionValueSchema,
  }),
]);
export type UserWithPrediction = Output<typeof UserWithPredictionSchema>;

export const PredictionSchema = object({
  userId: string(),
  gameId: string(),
  prediction: predictionValueSchema,
});
export type Prediction = Output<typeof PredictionSchema>;
