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

let userId = localStorage.getItem("userIdv2");
if (!userId) {
  /**
   * Ideally, we would be using ulid here, but the IoTProvider does not like ulids.
   */
  userId = uuid();
  localStorage.setItem("userId", userId);
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

export { PubSub, getUserId };
