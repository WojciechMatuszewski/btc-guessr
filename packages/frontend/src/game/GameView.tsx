import { Container, Flex, Text } from "@radix-ui/themes";
import { useCallback, useLayoutEffect, useState } from "react";
import { UserRow, UsersTable } from "./Users";
import { useGameState } from "./hooks";

interface GameViewProps {
  currentUserId: string;
}

export const GameView = ({ currentUserId }: GameViewProps) => {
  const gameState = useGameState();

  const usersByCurrentUser = [...gameState.users].sort((userA, userB) => {
    /**
     * Push A before B
     */
    if (userA.id === currentUserId) {
      return -1;
    }

    /**
     * Push B after A
     */
    if (userB.id === currentUserId) {
      return 1;
    }

    return 0;
  });

  return (
    <Container>
      <Flex
        direction={"column"}
        px={"4"}
        py={"6"}
        style={{ margin: "0 auto" }}
        width={"max-content"}
        gap={"2"}
      >
        <TickerCard value={gameState.game.value} />
        <TimeLeftInGame gameCreatedAtMs={gameState.game.createdAtMs} />
      </Flex>
      <UsersTable>
        {usersByCurrentUser.map((user) => {
          return (
            <UserRow
              isCurrentUser={currentUserId === user.id}
              gameId={gameState.game.id}
              key={user.id}
              user={user}
            />
          );
        })}
      </UsersTable>
    </Container>
  );
};

interface TickerCardProps {
  value: number;
}

const TickerCard = ({ value }: TickerCardProps) => {
  return (
    <Flex gap="2" align={"center"} width={"max-content"}>
      <Text size="9" color="yellow">
        $BTC
      </Text>
      <Text size="9">{value}</Text>
    </Flex>
  );
};

interface TimeLeftInGameProps {
  gameCreatedAtMs: number;
}

const TimeLeftInGame = ({ gameCreatedAtMs }: TimeLeftInGameProps) => {
  const calculateTimeLeft = useCallback(() => {
    const createdAtPlusMinuteMs = gameCreatedAtMs + 60_000;
    const nowMs = Date.now();

    if (createdAtPlusMinuteMs <= nowMs) {
      return 1;
    }

    return Math.max(1, Math.floor((createdAtPlusMinuteMs - nowMs) / 1_000));
  }, [gameCreatedAtMs]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useLayoutEffect(() => {
    /**
     * The `setInterval` will first fire after a second.
     * This creates a situation where the timer might seem to "lag" behind the value change.
     * Firing the calculation here prevents this from happening.
     */
    setTimeLeft(calculateTimeLeft());

    const intervalId = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [calculateTimeLeft]);

  return (
    <Text color={"gray"} size={"5"}>
      About{" "}
      <Text highContrast={true} size="6" color="iris">
        {timeLeft}s
      </Text>{" "}
      left to make a prediction
    </Text>
  );
};
