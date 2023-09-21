import {
  GameEvent,
  PredictionEvent,
  PresenceEvent,
} from "@btc-guessr/transport";

export const handler = async (
  event: GameEvent | PresenceEvent | PredictionEvent | null
) => {
  if (!event) {
    return;
  }
};
