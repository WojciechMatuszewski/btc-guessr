import { PubSubClass } from "@aws-amplify/pubsub/lib-esm/PubSub";

type SubscribeParams = Parameters<PubSubClass["subscribe"]>;

declare global {
  interface Window {
    Cypress?: unknown;
    PubSub?: {
      subscribe: (...params: Parameters<PubSubClass["subscribe"]>) => {
        subscribe: (
          listener: (param: { value: string | Record<string, unknown> }) => void
        ) => {
          unsubscribe: VoidFunction;
        };
      };
    };
  }
}

export {};
