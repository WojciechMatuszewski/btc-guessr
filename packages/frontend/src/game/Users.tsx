import { Prediction, UserWithPrediction } from "@btc-guessr/transport";
import { ThickArrowUpIcon, ThickArrowDownIcon } from "@radix-ui/react-icons";
import {
  Table,
  Flex,
  IconButton,
  VisuallyHidden,
  Text,
} from "@radix-ui/themes";
import { useMutation } from "@tanstack/react-query";
import { useGameDispatch } from "./hooks";

interface UsersTableProps {
  children: React.ReactNode;
}

export const UsersTable = ({ children }: UsersTableProps) => {
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
  isCurrentUser: boolean;
}

export const UserRow = ({ user, gameId, isCurrentUser }: UserRowProps) => {
  const dispatch = useGameDispatch();

  const { mutate: makePrediction, isLoading } = useMakePrediction({
    onSuccess: (prediction) => {
      dispatch({
        type: "prediction",
        payload: { gameId, prediction, userId: user.id },
      });
    },
  });

  return (
    <Table.Row align={"center"}>
      <Table.RowHeaderCell>
        {isCurrentUser ? (
          <Text data-testid="username" weight={"bold"}>
            {user.name} (You)
          </Text>
        ) : (
          <Text data-testid="username">{user.name}</Text>
        )}
      </Table.RowHeaderCell>
      <Table.Cell>
        <PredictionButtons
          isCurrentUser={isCurrentUser}
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
  isCurrentUser: boolean;
}

const PredictionButtons = ({
  isLoading,
  onPrediction,
  currentPrediction,
  isCurrentUser,
}: PredictionButtonsProps) => {
  const handleOnClick = (prediction: NonNullable<Prediction["prediction"]>) => {
    if (currentPrediction) {
      return;
    }

    if (!isCurrentUser) {
      return;
    }

    onPrediction(prediction);
  };

  const otherPlayerStyles: React.CSSProperties = {
    opacity: currentPrediction ? 1 : 0.5,
    pointerEvents: "none",
  };

  let fieldsetStyles: React.CSSProperties = {
    margin: 0,
    padding: 0,
    border: 0,
  };
  if (!isCurrentUser) {
    fieldsetStyles = { ...fieldsetStyles, ...otherPlayerStyles };
  }

  return (
    <Flex gap="3" asChild={true}>
      <fieldset style={fieldsetStyles} disabled={isLoading}>
        <IconButton
          aria-disabled={currentPrediction != null || !isCurrentUser}
          disabled={currentPrediction === "DOWN"}
          variant={currentPrediction === "UP" ? "solid" : "soft"}
          color="green"
          onClick={() => handleOnClick("UP")}
        >
          <VisuallyHidden>Vote up</VisuallyHidden>
          <ThickArrowUpIcon />
        </IconButton>
        <IconButton
          aria-disabled={currentPrediction != null || !isCurrentUser}
          disabled={currentPrediction === "UP"}
          variant={currentPrediction === "DOWN" ? "solid" : "soft"}
          color="red"
          onClick={() => handleOnClick("DOWN")}
        >
          <VisuallyHidden>Vote down</VisuallyHidden>
          <ThickArrowDownIcon />
        </IconButton>
      </fieldset>
    </Flex>
  );
};

const useMakePrediction = ({
  onSuccess,
}: {
  onSuccess: (prediction: NonNullable<Prediction["prediction"]>) => void;
}) => {
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

      return prediction;
    },
    onSuccess,
  });
};
