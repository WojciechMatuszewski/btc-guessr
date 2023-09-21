import {
  GameEvent,
  PredictionEvent,
  PresenceEvent,
} from "@btc-guessr/transport";

import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";

const client = new IoTDataPlaneClient({});

export const handler = async (
  events: Array<GameEvent | PresenceEvent | PredictionEvent>
) => {
  const pendingSends = events.map((event) => {
    return client.send(
      new PublishCommand({
        topic: "game",
        payload: JSON.stringify(event),
        qos: 1,
      })
    );
  });

  await Promise.all(pendingSends);
};
