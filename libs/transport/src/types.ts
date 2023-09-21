import { Output, literal, number, object, string, union } from "valibot";

export const GameSchema = object({
  id: string(),
  value: number(),
  room: string(),
});
export type Game = Output<typeof GameSchema>;

export const UserSchema = object({
  id: string(),
  status: union([literal("CONNECTED"), literal("DISCONNECTED")]),
  name: string(),
  score: number(),
});
export type User = Output<typeof UserSchema>;

export const PredictionSchema = object({
  userId: string(),
  gameId: string(),
  prediction: union([literal("UP"), literal("DOWN")]),
});
export type Prediction = Output<typeof PredictionSchema>;
