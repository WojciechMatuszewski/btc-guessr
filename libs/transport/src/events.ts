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

const PredictionEventSchema = object({
  type: literal("prediction"),
  payload: PredictionSchema,
});

export type PredictionEvent = Output<typeof PredictionEventSchema>;

const GameEventSchema = object({
  type: literal("game"),
  payload: GameSchema,
});

export type GameEvent = Output<typeof GameEventSchema>;

export const isGameEvent = (event: unknown): event is GameEvent => {
  return is(GameEventSchema, event);
};
