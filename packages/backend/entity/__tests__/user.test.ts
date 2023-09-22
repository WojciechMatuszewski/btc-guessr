import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { test, expect } from "vitest";
import { UserEntity } from "../user";
import { ulid } from "ulidx";
import pRetry from "p-retry";

const DATA_TABLE_NAME = process.env["DATA_TABLE_NAME"] as string;
const client = DynamoDBDocument.from(new DynamoDBClient({}));

test(
  "user can connect and disconnect from a given room",
  async () => {
    const userEntity = new UserEntity(DATA_TABLE_NAME, client);

    const userId = ulid();
    const roomId = ulid();

    await expect(
      userEntity.getConnectedUserItems({ room: roomId })
    ).resolves.toHaveLength(0);

    await userEntity.userConnected({
      id: userId,
      room: roomId,
      timestampMs: Date.now() - 10,
    });

    /**
     * We are reading after writing, as such we should retry the assertion
     * due to eventual consistency.
     */
    await pRetry(
      async () => {
        const connectedUsers = await userEntity.getConnectedUserItems({
          room: roomId,
        });

        expect(connectedUsers).toHaveLength(1);
      },
      { retries: 3 }
    );

    await userEntity.userDisconnected({ id: userId, timestampMs: Date.now() });

    await pRetry(
      async () => {
        const connectedUsers = await userEntity.getConnectedUserItems({
          room: roomId,
        });

        expect(connectedUsers).toHaveLength(0);
      },
      { retries: 3 }
    );
  },

  { timeout: 15_000 }
);

test("disconnection operation fails if it fires before the connection", async () => {
  const userEntity = new UserEntity(DATA_TABLE_NAME, client);

  const userId = ulid();
  const roomId = ulid();

  await expect(
    userEntity.getConnectedUserItems({ room: roomId })
  ).resolves.toHaveLength(0);

  const userConnectedTimestampMs = Date.now();

  await userEntity.userConnected({
    id: userId,
    room: roomId,
    timestampMs: userConnectedTimestampMs,
  });

  await pRetry(
    async () => {
      const connectedUsers = await userEntity.getConnectedUserItems({
        room: roomId,
      });

      expect(connectedUsers).toHaveLength(1);
    },
    { retries: 3 }
  );

  await expect(
    userEntity.userDisconnected({
      id: userId,
      timestampMs: userConnectedTimestampMs - 10,
    })
  ).rejects.toThrowError();
});

test(
  "updates the user scores, never dips below 0",
  async () => {
    const userEntity = new UserEntity(DATA_TABLE_NAME, client);

    const firstUserId = ulid();
    const secondUserId = ulid();

    const roomId = ulid();

    await Promise.all([
      await userEntity.userConnected({
        id: firstUserId,
        room: roomId,
        timestampMs: Date.now(),
      }),
      await userEntity.userConnected({
        id: secondUserId,
        room: roomId,
        timestampMs: Date.now(),
      }),
    ]);

    /**
     * Ensure that the users are connected
     */

    await pRetry(
      async () => {
        await expect(
          userEntity.getConnectedUserItems({ room: roomId })
        ).resolves.toHaveLength(2);
      },
      { retries: 3 }
    );

    await userEntity.updateUsersScore({
      scores: {
        [firstUserId]: -1,
        [secondUserId]: 1,
      },
    });

    await pRetry(
      async () => {
        await expect(
          userEntity.getUserItem({ id: firstUserId })
        ).resolves.toEqual(expect.objectContaining({ score: 0 }));
      },
      { retries: 3 }
    );

    await pRetry(
      async () => {
        await expect(
          userEntity.getUserItem({ id: secondUserId })
        ).resolves.toEqual(expect.objectContaining({ score: 1 }));
      },
      { retries: 3 }
    );
  },
  { timeout: 25_000 }
);
