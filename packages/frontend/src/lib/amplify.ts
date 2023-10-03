import { Amplify, PubSub } from "aws-amplify";
import { AWSIoTProvider } from "@aws-amplify/pubsub";
import { v4 as uuid } from "uuid";

const {
  VITE_IDENTITY_POOL_ID,
  VITE_USER_POOL_ID,
  VITE_USER_POOL_CLIENT_ID,
  VITE_REGION,
  VITE_IOT_ENDPOINT,
} = import.meta.env;

Amplify.configure({
  identityPoolId: VITE_IDENTITY_POOL_ID as string,
  region: VITE_REGION as string,
  userPoolId: VITE_USER_POOL_ID as string,
  userPoolWebClientId: VITE_USER_POOL_CLIENT_ID as string,
});

const USER_ID_KEY = "userIdv2";
let userId = localStorage.getItem(USER_ID_KEY);
if (!userId) {
  /**
   * Ideally, we would be using ulid here, but the IoTProvider does not like ulids.
   */
  userId = uuid();
  localStorage.setItem(USER_ID_KEY, userId);
}

Amplify.addPluggable(
  new AWSIoTProvider({
    clientId: userId,
    aws_pubsub_endpoint: VITE_IOT_ENDPOINT as string,
    aws_pubsub_region: VITE_REGION as string,
  })
);

const getUserId = () => {
  if (!userId) {
    throw new Error("Application integrity issue. UserId is not defined");
  }

  return userId;
};

const getPubSubClient = () => {
  /**
   * Due to how difficult intercepting MQTT WebSocket is,
   * I've decided to implement a "fake PubSub" in Cypress to be able to publish fake data to the UI.
   */
  if (window.Cypress && window.PubSub) {
    return window.PubSub;
  }

  return PubSub;
};

export { getPubSubClient, getUserId };
