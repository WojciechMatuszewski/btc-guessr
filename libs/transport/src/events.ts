import { Output, literal, object } from "valibot";
import { GameSchema, PredictionSchema, UserSchema } from "./types";

const PresenceEventSchema = object({
  type: literal("presence"),
  payload: UserSchema,
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
