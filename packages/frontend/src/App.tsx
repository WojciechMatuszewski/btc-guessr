import { Game, Prediction, User } from "@btc-guessr/transport";
import { ThickArrowDownIcon, ThickArrowUpIcon } from "@radix-ui/react-icons";
import {
  Card,
  Container,
  Flex,
  IconButton,
  Table,
  Text,
} from "@radix-ui/themes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PubSub } from "aws-amplify";
import { useEffect, useState } from "react";

console.log(import.meta.env);

// Amplify.configure({
//   identityPoolId: "xx",
//   region: "Xx",
//   userPoolId: "xx",
//   userPoolWebClientId: "Xx",
// });

// let userId = localStorage.getItem("userId") as string;

// if (!userId) {
//   userId = "mqtt-explorer-" + Math.floor(Math.random() * 100000 + 1);
//   localStorage.setItem("userId", userId);
// }

function App() {
  return (
    <Container p="4">
      <Flex direction={"column"} gap="8">
        <TickerCard value={100} />
        <UsersTable />
      </Flex>
    </Container>
  );
  // const { isLoading, error, data } = useGetGame();
  // if (error) {
  //   return <div>{JSON.stringify(error)}</div>;
  // }

  // if (isLoading || !data) {
  //   return <div>Loading...</div>;
  // }

  // return (
  //   <Game userId={userId} initialGame={data.game} initialUsers={data.users} />
  // );
}

export default App;

// Amplify.addPluggable(
//   new AWSIoTProvider({
//     clientId: userId,
//     aws_pubsub_endpoint: "xx",
//     aws_pubsub_region: "xx",
//   })
// );

type UserWithPrediction = User & {
  prediction: Prediction["prediction"] | null;
};

interface AppState {
  game: Game;
  users: UserWithPrediction[];
}

interface GameProps {
  initialGame: Game;
  initialUsers: UserWithPrediction[];
  userId: string;
}

function Game({ initialGame, initialUsers, userId }: GameProps) {
  const [appState, setAppState] = useState<AppState>({
    game: initialGame,
    users: initialUsers,
  });

  useEffect(() => {
    const subscription = PubSub.subscribe("game").subscribe((event) => {
      console.log(event);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const { mutate } = useMakePrediction();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          mutate({ gameId: appState.game.id, userId: userId });
        }}
      >
        Predict
      </button>
      {appState.game.value}
    </div>
  );
}

const useGetGame = () => {
  return useQuery({
    queryFn: async () => {
      const response = await fetch("Xx");
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const { game, users, predictions } = (await response.json()) as {
        game: Game;
        users: User[];
        predictions: Prediction[];
      };
      const usersWithPredictions: UserWithPrediction[] = users.map((user) => {
        const predictionMadeByUser = predictions.find(
          (prediction) => prediction.userId === user.id
        );

        return {
          ...user,
          prediction: predictionMadeByUser?.prediction ?? null,
        };
      });

      return { game, users: usersWithPredictions };
    },
    queryKey: ["game"],
  });
};

const useMakePrediction = () => {
  return useMutation({
    mutationFn: async ({
      userId,
      gameId,
    }: {
      userId: string;
      gameId: string;
    }) => {
      const response = await fetch(`xx`, {
        method: "POST",
        body: JSON.stringify({ userId, prediction: "DOWN" }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
  });
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

const PredictionButtons = () => {
  return (
    <Flex gap="3">
      <IconButton variant="soft" color="green" style={{ cursor: "pointer" }}>
        <ThickArrowUpIcon />
      </IconButton>
      <IconButton variant="soft" color="red" style={{ cursor: "pointer" }}>
        <ThickArrowDownIcon />
      </IconButton>
    </Flex>
  );
};

const UsersTable = () => {
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Prediction</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Points</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>

      <Table.Body>
        <Table.Row align={"center"}>
          <Table.RowHeaderCell>Danilo Sousa</Table.RowHeaderCell>
          <Table.Cell>
            <PredictionButtons />
          </Table.Cell>
          <Table.Cell>0</Table.Cell>
        </Table.Row>

        <Table.Row align={"center"}>
          <Table.RowHeaderCell>Zahra Ambessa</Table.RowHeaderCell>
          <Table.Cell>
            <PredictionButtons />
          </Table.Cell>
          <Table.Cell>0</Table.Cell>
        </Table.Row>

        <Table.Row align={"center"}>
          <Table.RowHeaderCell>Jasper Eriksson</Table.RowHeaderCell>
          <Table.Cell>
            <PredictionButtons />
          </Table.Cell>
          <Table.Cell>0</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  );
};
