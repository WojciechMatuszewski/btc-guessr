import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBRecord } from "aws-lambda";

export const handler = async (event: DynamoDBRecord[]) => {
  const [record] = event;
  if (!record?.dynamodb) {
    throw new Error("Malformed data");
  }

  const { NewImage = {}, OldImage = {} } = record.dynamodb;
  const parsedNewImage = unmarshall(NewImage as Record<string, AttributeValue>);
  const parsedOldImage = unmarshall(OldImage as Record<string, AttributeValue>);

  console.log({ parsedNewImage, parsedOldImage });

  return NewImage;
};

type TickEvent = {
  type: "tick";
  payload: {
    value: number;
  };
};

// const isTickEvent = (event: Record<string, any>) => {
//   const hasValidPk = "pk" in event && event["pk"] === "TICK";
//   const hasValidSk = "sk" in event && event["sk"] === "TICK";

//   return hasValidPk && hasValidSk;
// };

type VoteEvent = {
  type: "vote";
  payload: {
    userId: string;
    vote: "up" | "down";
  };
};

type PresenceEvent = {
  type: "presence";
  payload: {
    userId: string;
    status: "CONNECTED" | "DISCONNECTED";
  };
};

// const isPresenceEvent = (event: Record<string, any>) => {
//   const hasValidPk = "pk" in event && event["pk"] === "USER";

//   const hasValidSk =
//     "sk" in event &&
//     typeof event["sk"] === "string" &&
//     event["sk"].startsWith("USER#");

//   const hasValidStatus = "status" in event;

//   return hasValidPk && hasValidSk && hasValidStatus;
// };
