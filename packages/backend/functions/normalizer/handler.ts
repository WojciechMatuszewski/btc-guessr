import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBRecord } from "aws-lambda";

export const handler = async (event: DynamoDBRecord[]) => {
  const [record] = event;

  if (!record?.dynamodb) {
    throw new Error("Malformed event");
  }

  const { OldImage, NewImage } = record.dynamodb;

  const oldImage = OldImage
    ? unmarshall(OldImage as Record<string, AttributeValue>)
    : null;

  const newImage = NewImage
    ? unmarshall(NewImage as Record<string, AttributeValue>)
    : null;

  console.log("new image", newImage);
  console.log("old image", oldImage);

  return { newImage, oldImage };
};
