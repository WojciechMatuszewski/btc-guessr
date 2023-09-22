import { Output, is, literal, object } from "valibot";
import {
  GameSchema,
  PredictionSchema,
  UserWithPredictionSchema,
} from "./types";

const PresenceEventSchema = object({
  type: literal("presence"),
  payload: UserWithPredictionSchema,
});
export type PresenceEvent = Output<typeof PresenceEventSchema>;
export const isPresenceEvent = (data: unknown): data is PresenceEvent => {
  return is(PresenceEventSchema, data);
};

const PredictionEventSchema = object({
  type: literal("prediction"),
  payload: PredictionSchema,
});
export type PredictionEvent = Output<typeof PredictionEventSchema>;
export const isPredictionEvent = (data: unknown): data is PredictionEvent => {
  return is(PredictionEventSchema, data);
};

const GameEventSchema = object({
  type: literal("game"),
  payload: GameSchema,
});
export type GameEvent = Output<typeof GameEventSchema>;
export const isGameEvent = (event: unknown): event is GameEvent => {
  return is(GameEventSchema, event);
};
