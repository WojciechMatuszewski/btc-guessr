import { Game, UserWithPrediction } from "@btc-guessr/transport";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { PubSub } from "../lib/amplify";

interface GameStateProviderProps {
  userId: string;
  children: React.ReactNode;
}

export const GameStateProvider = ({
  userId,
  children,
}: GameStateProviderProps) => {
  useEffect(() => {
    const subscription = PubSub.subscribe("game").subscribe((event) => {
      console.log("event", event);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  const { isLoading, isError, data: gameState } = useFetchGameState({ userId });

  if (isError) {
    return <div>Error</div>;
  }

  if (isLoading || !gameState) {
    return <div>Loading</div>;
  }

  return (
    <div>
      {JSON.stringify(gameState.game)}
      {children}
    </div>
  );
};

type GameState = {
  game: Game;
  users: UserWithPrediction[];
};

const useFetchGameState = ({ userId }: { userId: string }) => {
  return useQuery<GameState, unknown, GameState>({
    queryKey: ["game", userId],
    queryFn: async () => {
      const endpointUrl = import.meta.env.VITE_GAME_ENDPOINT_URL as string;
      const response = await fetch(endpointUrl);
      if (!response.ok) {
        throw new Error("Failed");
      }

      const data = (await response.json()) as GameState;

      const isWithinUsers = data.users.find((fetchedUser) => {
        return fetchedUser.id === userId;
      });
      if (!isWithinUsers) {
        throw new GameStateNotReadyError();
      }

      return data;
    },
    retryDelay: (_, error) => {
      if (error instanceof GameStateNotReadyError) {
        return 2_000;
      }

      return 0;
    },
    retry: (retryCount, error) => {
      if (error instanceof GameStateNotReadyError) {
        return retryCount < 3;
      }

      return false;
    },
  });
  //   return useQuery<GameState, unknown, GameState>(
  //     {
  //       queryKey: ["game", userId],
  //       queryFn: async () => {
  //         const endpointUrl = import.meta.env.VITE_GAME_ENDPOINT_URL as string;
  //         const response = await fetch(endpointUrl);
  //         if (!response.ok) {
  //           throw new Error("Failed");
  //         }

  //         const data = (await response.json()) as GameState;

  //         const isWithinUsers = data.users.find((fetchedUser) => {
  //           return fetchedUser.id === userId;
  //         });
  //         if (!isWithinUsers) {
  //           throw new GameStateNotReadyError();
  //         }

  //         return data;
  //       },
  //     },
  //     {
  //       retryDelay: (_, error) => {
  //         if (error instanceof GameStateNotReadyError) {
  //           return 1_000;
  //         }

  //         return false;
  //       },
  //       retry: (retryCount, error) => {
  //         if (error instanceof GameStateNotReadyError) {
  //           return retryCount < 3;
  //         }

  //         return false;
  //       },
  //     }
  //   );
};

class GameStateNotReadyError extends Error {
  constructor() {
    super("Game state not ready");
  }
}
