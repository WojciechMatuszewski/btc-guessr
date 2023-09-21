import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { randAnimal, randProductAdjective } from "@ngneat/falso";
import {
  Output,
  is,
  literal,
  merge,
  number,
  object,
  startsWith,
  string,
  union,
} from "valibot";

const UserKeySchema = object({
  pk: literal("USER"),
  sk: string([startsWith("USER#")]),
});
type UserKey = Output<typeof UserKeySchema>;

const UserAttributesSchema = object({
  status: union([literal("CONNECTED"), literal("DISCONNECTED")]),
  id: string([]),
  name: string(),
  score: number(),
});

const UserItemSchema = merge([UserKeySchema, UserAttributesSchema]);
type UserItem = Output<typeof UserItemSchema>;
type UserStatus = UserItem["status"];

export class UserEntity {
  constructor(
    private tableName: string,
    private client: DynamoDBDocument
  ) {}

  async upsertUser({ status, id }: { status: UserStatus; id: string }) {
    if (status === "CONNECTED") {
      const userName = `${randProductAdjective()} ${randAnimal()}`;

      await this.client.update({
        TableName: this.tableName,
        Key: UserEntity.userKey({ id }),
        UpdateExpression:
          "SET #status = :status, #name = if_not_exists(#name, :name), #id = if_not_exists(#id, :id), #score = if_not_exists(#score, :score)",
        ExpressionAttributeNames: {
          "#name": "name",
          "#status": "status",
          "#id": "id",
          "#score": "score",
        },
        ExpressionAttributeValues: {
          ":name": userName,
          ":status": status,
          ":id": id,
          ":score": 0,
        },
      });
    }

    if (status === "DISCONNECTED") {
      await this.client.update({
        TableName: this.tableName,
        Key: UserEntity.userKey({ id }),
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: {
          "#id": "id",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": status,
        },
        ConditionExpression: "attribute_exists(#id)",
      });
    }
  }

  static userKey({ id }: { id: string }): UserKey {
    return {
      pk: "USER",
      sk: `USER#${id}`,
    };
  }

  static isUserItem(data: unknown): data is UserItem {
    return is(UserItemSchema, data);
  }
}
