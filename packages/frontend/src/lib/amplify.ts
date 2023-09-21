import { Amplify, PubSub } from "aws-amplify";
import { AWSIoTProvider } from "@aws-amplify/pubsub";

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

let userId = localStorage.getItem("userId");
if (!userId) {
  userId = "mqtt-explorer-" + Math.floor(Math.random() * 100000 + 1);
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
  return userId;
};

export { PubSub, getUserId };
