import { render, screen } from "@testing-library/react";
import { UserRow } from "../Users";
import { expect, describe, test, vi } from "vitest";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { getByText } from "@testing-library/dom";
import { v4 as uuid } from "uuid";

vi.mock("../hooks.ts", () => ({
  useGameDispatch: () => {
    return () => {};
  },
}));

const queryClient = new QueryClient();

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <table>
        <tbody>{children}</tbody>
      </table>
    </QueryClientProvider>
  );
};

describe("current user", () => {
  const isCurrentUser = true;

  test("The 'up' button is disables when the user predicted that the price will go down", () => {
    const gameId = uuid();
    const userId = uuid();

    render(
      <UserRow
        gameId={gameId}
        user={{
          id: userId,
          status: "CONNECTED",
          name: "TestUser",
          score: 0,
          prediction: "DOWN",
        }}
        isCurrentUser={isCurrentUser}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByRole("button", { name: "Vote up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vote down" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  test("The 'down' button is disables when the user predicted that the price will go up", () => {
    const gameId = uuid();
    const userId = uuid();

    render(
      <UserRow
        gameId={gameId}
        user={{
          id: userId,
          status: "CONNECTED",
          name: "TestUser",
          score: 0,
          prediction: "UP",
        }}
        isCurrentUser={isCurrentUser}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByRole("button", { name: "Vote down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vote up" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  test("The prediction buttons are enabled when the user already made a prediction", () => {
    const gameId = uuid();
    const userId = uuid();

    render(
      <UserRow
        gameId={gameId}
        user={{
          id: userId,
          status: "CONNECTED",
          name: "TestUser",
          score: 0,
          prediction: null,
        }}
        isCurrentUser={isCurrentUser}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByRole("button", { name: "Vote up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Vote down" })).toBeEnabled();
  });

  test("Add the `you` indicator to the player name", () => {
    const gameId = uuid();
    const userId = uuid();

    render(
      <UserRow
        gameId={gameId}
        user={{
          id: userId,
          status: "CONNECTED",
          name: "TestUser",
          score: 0,
          prediction: null,
        }}
        isCurrentUser={isCurrentUser}
      />,
      { wrapper: Wrapper }
    );

    const textContainer = screen.getByTestId("username");
    expect(
      getByText(textContainer, (content) => {
        return content.trim() === "TestUser (You)";
      })
    ).toBeInTheDocument();
  });
});

describe("other player", () => {
  const isCurrentUser = false;

  test("The prediction buttons are marked as disabled", () => {
    const gameId = uuid();
    const userId = uuid();

    render(
      <UserRow
        gameId={gameId}
        user={{
          id: userId,
          status: "CONNECTED",
          name: "TestUser",
          score: 0,
          prediction: null,
        }}
        isCurrentUser={isCurrentUser}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByRole("button", { name: "Vote up" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );

    expect(screen.getByRole("button", { name: "Vote down" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});
