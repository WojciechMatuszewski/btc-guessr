import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { randAnimal, randProductAdjective } from "@ngneat/falso";
import {
  Output,
  is,
  literal,
  merge,
  number,
  object,
  parse,
  startsWith,
  string,
  union,
} from "valibot";
import { User } from "@btc-guessr/transport";

const UserKeySchema = object({
  pk: literal("USER"),
  sk: string([startsWith("USER#")]),
});
type UserKey = Output<typeof UserKeySchema>;

const UserByStatusKeySchema = object({
  gsi1pk: union([
    string([startsWith("CONNECTED#ROOM#")]),
    literal("DISCONNECTED"),
  ]),
});

const UserAttributesSchema = object({
  status: union([literal("CONNECTED"), literal("DISCONNECTED")]),
  id: string([]),
  name: string(),
  score: number(),
});

const UserItemSchema = merge([
  UserKeySchema,
  UserByStatusKeySchema,
  UserAttributesSchema,
]);
type UserItem = Output<typeof UserItemSchema>;
type UserStatus = UserItem["status"];

const ConnectedUserSchema = merge([
  UserItemSchema,
  object({
    status: literal("CONNECTED"),
    gsi1pk: string([startsWith("CONNECTED#ROOM#")]),
  }),
]);
type ConnectedUser = Output<typeof ConnectedUserSchema>;

export class UserEntity {
  constructor(
    private tableName: string,
    private client: DynamoDBDocument
  ) {}

  async userConnected({ id, room }: { id: string; room: string }) {
    const userName = `${randProductAdjective()} ${randAnimal()}`;
    const status: UserStatus = "CONNECTED";

    await this.client.update({
      TableName: this.tableName,
      Key: UserEntity.userKey({ id }),
      UpdateExpression:
        "SET #gsi1pk = :gsi1pk, #status = :status, #name = if_not_exists(#name, :name), #id = if_not_exists(#id, :id), #score = if_not_exists(#score, :score)",
      ExpressionAttributeNames: {
        "#name": "name",
        "#status": "status",
        "#id": "id",
        "#score": "score",
        "#gsi1pk": "gsi1pk",
      },
      ExpressionAttributeValues: {
        ":name": userName,
        ":status": status,
        ":gsi1pk": `${status}#ROOM#${room}`,
        ":id": id,
        ":score": 0,
      },
    });
  }

  async userDisconnected({ id }: { id: string }) {
    const status: UserStatus = "DISCONNECTED";

    await this.client.update({
      TableName: this.tableName,
      Key: UserEntity.userKey({ id }),
      UpdateExpression: "SET #gsi1pk = :status, #status = :status",
      ExpressionAttributeNames: {
        "#id": "id",
        "#status": "status",
        "#gsi1pk": "gsi1pk",
      },
      ExpressionAttributeValues: {
        ":status": status,
      },
      ConditionExpression: "attribute_exists(#id)",
    });
  }

  async getUserItem({ id }: { id: string }): Promise<UserItem> {
    const { Item } = await this.client.get({
      TableName: this.tableName,
      Key: UserEntity.userKey({ id }),
    });
    if (!Item) {
      throw new UserNotFoundError();
    }

    return parse(UserItemSchema, Item);
  }

  async getConnectedUserItems({
    room,
  }: {
    room: string;
  }): Promise<ConnectedUser[]> {
    const { Items = [] } = await this.client.query({
      TableName: this.tableName,
      IndexName: "ByUserStatus",
      KeyConditionExpression: "#gsi1pk = :status",
      ExpressionAttributeValues: {
        ":status": `CONNECTED#ROOM#${room}`,
      },
      ExpressionAttributeNames: {
        "#gsi1pk": "gsi1pk",
      },
    });

    const validatedConnectedUsers = Items.map((user) => {
      return parse(ConnectedUserSchema, user);
    });
    return validatedConnectedUsers;
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

  static toUser(userItem: UserItem): User {
    return {
      id: userItem.id,
      name: userItem.name,
      score: userItem.score,
      status: userItem.status,
    };
  }

  static isUserItemPresenceChange(payload: {
    oldItem: unknown;
    newItem: unknown;
  }): payload is { oldItem: UserItem | null; newItem: UserItem } {
    const { newItem, oldItem } = payload;

    if (!is(UserItemSchema, newItem)) {
      return false;
    }

    /**
     * Connection
     */
    if (oldItem === null) {
      return true;
    }

    if (!is(UserItemSchema, oldItem)) {
      return false;
    }

    return oldItem.status !== newItem.status;
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
  }
}
