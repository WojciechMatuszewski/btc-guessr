import { useContext } from "react";
import { GameStateContext, GameDispatchContext } from "./GameStateProvider";

/**
 * I had to export the hooks here for the fast-refresh to work.
 * Normally I would keep them inside `GameStateProvider`
 */

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
