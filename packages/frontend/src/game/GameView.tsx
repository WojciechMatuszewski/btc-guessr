import {
  Card,
  Container,
  Flex,
  IconButton,
  Table,
  Text,
} from "@radix-ui/themes";
import { useGameDispatch, useGameState } from "./GameStateProvider";
import { ThickArrowUpIcon, ThickArrowDownIcon } from "@radix-ui/react-icons";
import { Prediction, UserWithPrediction } from "@btc-guessr/transport";
import { useMutation } from "@tanstack/react-query";

export const GameView = () => {
  const gameState = useGameState();

  return (
    <Container>
      <TickerCard value={gameState.game.value} />
      <UsersTable>
        {gameState.users.map((user) => {
          return (
            <UserRow gameId={gameState.game.id} key={user.id} user={user} />
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
    <Card style={{ width: "max-content" }} m="auto" variant="ghost">
      <Flex gap="2" align={"center"} p="4" width={"max-content"}>
        <Text size="8" color="yellow">
          $BTC
        </Text>
        <Text size="8">{value}</Text>
      </Flex>
    </Card>
  );
};

interface UsersTableProps {
  children: React.ReactNode;
}

const UsersTable = ({ children }: UsersTableProps) => {
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Prediction</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Points</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>{children}</Table.Body>
    </Table.Root>
  );
};

interface UserRowProps {
  user: UserWithPrediction;
  gameId: string;
}

const UserRow = ({ user, gameId }: UserRowProps) => {
  const dispatch = useGameDispatch();

  const { mutate: makePrediction, isLoading } = useMakePrediction({
    onSuccess: () => {
      dispatch({
        type: "prediction",
        payload: { gameId, prediction: "", userId: user.id },
      });
    },
  });

  return (
    <Table.Row align={"center"}>
      <Table.RowHeaderCell>{user.name}</Table.RowHeaderCell>
      <Table.Cell>
        <PredictionButtons
          isLoading={isLoading}
          currentPrediction={user.prediction}
          onPrediction={(prediction) => {
            makePrediction({ gameId, prediction, userId: user.id });
          }}
        />
      </Table.Cell>
      <Table.Cell>{user.score}</Table.Cell>
    </Table.Row>
  );
};

interface PredictionButtonsProps {
  onPrediction: (prediction: NonNullable<Prediction["prediction"]>) => void;
  currentPrediction: Prediction["prediction"];
  isLoading: boolean;
}

const PredictionButtons = ({
  isLoading,
  onPrediction,
  currentPrediction,
}: PredictionButtonsProps) => {
  const handleOnClick = (prediction: NonNullable<Prediction["prediction"]>) => {
    if (currentPrediction) {
      return;
    }

    onPrediction(prediction);
  };

  return (
    <Flex gap="3" asChild={true}>
      <fieldset
        style={{ margin: 0, padding: 0, border: 0 }}
        disabled={isLoading}
      >
        <IconButton
          disabled={currentPrediction === "DOWN"}
          variant={currentPrediction === "UP" ? "solid" : "soft"}
          color="green"
          style={{ cursor: "pointer" }}
          onClick={() => handleOnClick("UP")}
        >
          <ThickArrowUpIcon />
        </IconButton>
        <IconButton
          disabled={currentPrediction === "UP"}
          variant={currentPrediction === "DOWN" ? "solid" : "soft"}
          color="red"
          style={{ cursor: "pointer" }}
          onClick={() => handleOnClick("DOWN")}
        >
          <ThickArrowDownIcon />
        </IconButton>
      </fieldset>
    </Flex>
  );
};

const useMakePrediction = ({ onSuccess }: { onSuccess: VoidFunction }) => {
  return useMutation({
    mutationFn: async ({
      userId,
      gameId,
      prediction,
    }: {
      userId: string;
      gameId: string;
      prediction: NonNullable<Prediction["prediction"]>;
    }) => {
      const endpointUrl = (
        import.meta.env.VITE_PREDICT_ENDPOINT_URL as string
      ).replace("{gameId}", gameId);

      const response = await fetch(endpointUrl, {
        method: "POST",
        body: JSON.stringify({ userId, prediction: prediction }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
  });
};
