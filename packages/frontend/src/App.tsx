import { AWSIoTProvider } from "@aws-amplify/pubsub";
import { Game, Prediction, User } from "@btc-guessr/transport";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Amplify, PubSub } from "aws-amplify";
import { useEffect, useState } from "react";

Amplify.configure({
  identityPoolId: "xx",
  region: "Xx",
  userPoolId: "xx",
  userPoolWebClientId: "Xx",
});

let userId = localStorage.getItem("userId") as string;

if (!userId) {
  userId = "mqtt-explorer-" + Math.floor(Math.random() * 100000 + 1);
  localStorage.setItem("userId", userId);
}

function App() {
  const { isLoading, error, data } = useGetGame();
  if (error) {
    return <div>{JSON.stringify(error)}</div>;
  }

  if (isLoading || !data) {
    return <div>Loading...</div>;
  }

  return (
    <Game userId={userId} initialGame={data.game} initialUsers={data.users} />
  );
}

export default App;

Amplify.addPluggable(
  new AWSIoTProvider({
    clientId: userId,
    aws_pubsub_endpoint: "xx",
    aws_pubsub_region: "xx",
  })
);

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
