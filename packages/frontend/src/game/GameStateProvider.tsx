import {
  Game,
  GameEvent,
  Prediction,
  PredictionEvent,
  PresenceEvent,
  UserWithPrediction,
  isGameEvent,
  isPredictionEvent,
  isPresenceEvent,
} from "@btc-guessr/transport";
import { Flex, Heading } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import {
  Dispatch,
  ReducerAction,
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { PubSub } from "../lib/amplify";

interface GameState {
  game: Game;
  users: UserWithPrediction[];
}

interface GameStateProviderProps {
  userId: string;
  children: React.ReactNode;
}

const GameStateContext = createContext<GameState | null>(null);
const GameDispatchContext = createContext<Dispatch<
  ReducerAction<typeof gameStateReducer>
> | null>(null);

export const GameStateProvider = ({
  userId,
  children,
}: GameStateProviderProps) => {
  const [gameState, dispatch] = useReducer(gameStateReducer, null);

  useEffect(() => {
    const subscription = PubSub.subscribe("game").subscribe((event) => {
      if (isPresenceEvent(event.value)) {
        if (event.value.payload.id === userId) {
          return;
        }

        dispatch(event.value);
      }

      if (isGameEvent(event.value)) {
        dispatch(event.value);
      }

      if (isPredictionEvent(event.value)) {
        dispatch(event.value);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const { isLoading, isError } = useFetchGameState({
    userId,
    onSuccess: (fetchedGameState) => {
      dispatch({ type: "hydrateState", payload: fetchedGameState });
    },
  });

  if (isError) {
    return <ErrorScreen />;
  }

  if (isLoading || !gameState) {
    return <LoadingScreen />;
  }

  return (
    <GameStateContext.Provider value={gameState}>
      <GameDispatchContext.Provider value={dispatch}>
        <>{children}</>
      </GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error("`useGameState` used outside of the provider");
  }

  return context;
};

export const useGameDispatch = () => {
  const context = useContext(GameDispatchContext);
  if (!context) {
    throw new Error("`useGameDispatch` used outside of the provider");
  }

  return context;
};

const LoadingScreen = () => {
  return (
    <Flex
      asChild={true}
      position={"fixed"}
      width={"100%"}
      height={"100%"}
      align={"center"}
      justify={"center"}
      direction={"column"}
      gap={"3"}
    >
      <section>
        <Heading size="8" as="h1">
          Loading game state
        </Heading>
        <Heading size="4" as="h2">
          This might take up to a minute
        </Heading>
      </section>
    </Flex>
  );
};

const ErrorScreen = () => {
  return (
    <Flex
      asChild={true}
      position={"fixed"}
      width={"100%"}
      height={"100%"}
      align={"center"}
      justify={"center"}
      direction={"column"}
      gap={"3"}
    >
      <section>
        <Heading size="8" as="h1" color="red">
          An error occurred
        </Heading>
        <Heading size="4" as="h2">
          Please reload the page
        </Heading>
      </section>
    </Flex>
  );
};

const useFetchGameState = ({
  userId,
  onSuccess,
}: {
  userId: string;
  onSuccess: (gameState: GameState) => void;
}) => {
  return useQuery<GameState, unknown, GameState>({
    queryKey: ["game", userId],
    queryFn: async () => {
      const endpointUrl = import.meta.env.VITE_GAME_ENDPOINT_URL as string;
      const response = await fetch(endpointUrl);
      if (response.status === 404) {
        throw new GameNotFoundError();
      }

      if (!response.ok) {
        throw new Error(`Internal error: ${await response.text()}`);
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
    onSuccess: onSuccess,
    retryDelay: (_, error) => {
      if (error instanceof GameStateNotReadyError) {
        return 2_000;
      }

      if (error instanceof GameNotFoundError) {
        /**
         * A minute and 10 seconds to ensure the new game is already created.
         * The ticker runs every minute or so.
         */
        return 70_000;
      }

      return 0;
    },
    retry: (retryCount, error) => {
      if (error instanceof GameStateNotReadyError) {
        return retryCount < 3;
      }

      if (error instanceof GameNotFoundError) {
        return retryCount < 2;
      }

      return false;
    },
  });
};

class GameStateNotReadyError extends Error {
  constructor() {
    super("Game state not ready");
  }
}

class GameNotFoundError extends Error {
  constructor() {
    super("Game not found");
  }
}

type GameStateHydrationEvent = {
  type: "hydrateState";
  payload: GameState;
};

const gameStateReducer = (
  state: GameState | null,
  event: PresenceEvent | GameEvent | PredictionEvent | GameStateHydrationEvent
) => {
  switch (event.type) {
    case "hydrateState": {
      return event.payload;
    }
    case "presence": {
      if (!state) {
        return state;
      }

      if (event.payload.status === "CONNECTED") {
        const newUsers = [...state.users, event.payload];
        return { ...state, users: newUsers };
      }

      if (event.payload.status === "DISCONNECTED") {
        const newUsers = state.users.filter((user) => {
          return user.id === event.payload.id;
        });
        return { ...state, users: newUsers };
      }

      return state;
    }
    case "prediction": {
      if (!state) {
        return state;
      }

      const newUsers = state.users.map((user) => {
        const isMatchingUser = user.id === event.payload.userId;
        if (!isMatchingUser) {
          return user;
        }

        return { ...user, prediction: event.payload.prediction };
      });

      return { ...state, users: newUsers };
    }
    case "game": {
      if (!state) {
        return state;
      }

      const currentValue = state.game.value;
      const newValue = event.payload.value;
      const difference = newValue - currentValue;
      const correctPrediction: Prediction["prediction"] =
        difference < 0 ? "DOWN" : "UP";

      const newUsers = state.users.map((user) => {
        const userPrediction = user.prediction;
        if (!userPrediction) {
          return user;
        }

        if (userPrediction === correctPrediction) {
          user.score = user.score + 1;
        }

        if (userPrediction !== correctPrediction) {
          user.score = Math.min(0, user.score - 1);
        }

        return user;
      });

      return { game: event.payload, users: newUsers };
    }
    default:
      return state;
  }
};
