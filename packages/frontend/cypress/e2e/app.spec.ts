import {
  Game,
  PredictionEvent,
  PresenceEvent,
  UserWithPrediction,
} from "@btc-guessr/transport";
import { v4 as uuid } from "uuid";

it("Works end-to-end", () => {
  const userId = uuid();
  const gameId = uuid();

  const gameState: { users: UserWithPrediction[]; game: Game } = {
    users: [
      {
        id: userId,
        name: "Test user",
        score: 0,
        status: "CONNECTED",
        prediction: null,
      },
    ],
    game: {
      createdAtMs: Date.now(),
      id: gameId,
      room: "default",
      value: 123,
    },
  };
  const gameEndpointUrl = Cypress.env("CYPRESS_GAME_ENDPOINT_URL") as string;
  cy.intercept(gameEndpointUrl, gameState);

  const subscriptionSpy = cy
    .spy(
      {
        subscribe: () => ({ unsubscribe: () => {} }),
      },
      "subscribe"
    )
    .as("subscribeSpy");

  cy.visit("/", {
    onBeforeLoad: (window) => {
      window.localStorage.setItem("userIdv2", userId);
      window.PubSub = {
        subscribe: () => ({
          subscribe: subscriptionSpy,
        }),
      };
    },
  });

  /**
   * The app hydrates correctly given a certain game state
   */
  cy.findByRole("heading", { name: `$BTC ${gameState.game.value}` }).should(
    "be.visible"
  );

  cy.findByRole("rowheader", {
    name: `${gameState.users[0].name} (You)`,
  }).should("be.visible");

  /**
   * User can make predictions
   */
  const predictEndpointUrl = Cypress.env(
    "CYPRESS_PREDICT_ENDPOINT_URL"
  ) as string;
  cy.intercept(predictEndpointUrl.replace("{gameId}", gameId), {
    statusCode: 201,
    body: {},
  }).as("predictPrice");

  cy.findByTestId(`user-${userId}-row`).within(() => {
    cy.findByRole("button", { name: "Predict up" }).should("not.be.disabled");
    cy.findByRole("button", { name: "Predict up" }).should(
      "have.attr",
      "aria-disabled",
      "false"
    );

    cy.findByRole("button", { name: "Predict down" }).should("not.be.disabled");
    cy.findByRole("button", { name: "Predict down" }).should(
      "have.attr",
      "aria-disabled",
      "false"
    );

    cy.findByRole("button", { name: "Predict up" }).click();
  });

  cy.wait("@predictPrice")
    .its("request.body")
    .should(
      "eq",
      JSON.stringify({
        userId: userId,
        prediction: "UP",
      })
    );

  cy.findByTestId(`user-${userId}-row`).within(() => {
    cy.findByRole("button", { name: "Predict down" }).should("be.disabled");
    cy.findByRole("button", { name: "Predict up" }).should(
      "have.attr",
      "aria-disabled",
      "true"
    );
  });

  /**
   * The app reacts to presence CONNECTED event
   */
  cy.get("@subscribeSpy").invoke("getCalls").should("have.length", 2);

  cy.get("@subscribeSpy")
    .invoke("getCalls")
    .invoke("at", -1)
    .its("args")
    .invoke("at", -1)
    .then((listener: (...args: unknown[]) => void) => ({ listener }))
    .as("subscription");

  const secondUserId = uuid();
  const connectionEvent: PresenceEvent = {
    payload: {
      id: secondUserId,
      name: "New user",
      prediction: null,
      score: 0,
      status: "CONNECTED",
    },
    type: "presence",
  };

  cy.findByRole("rowheader", { name: connectionEvent.payload.name }).should(
    "not.exist"
  );

  cy.get("@subscription").invoke("listener", { value: connectionEvent });

  cy.findByRole("rowheader", { name: connectionEvent.payload.name }).should(
    "be.visible"
  );

  /**
   * The UI updates when other player predicts the price.
   */
  cy.findByTestId(`user-${secondUserId}-row`).within(() => {
    cy.findByRole("button", { name: "Predict up" }).should("be.enabled");
    cy.findByRole("button", { name: "Predict up" }).should(
      "have.attr",
      "aria-disabled",
      "true"
    );

    cy.findByRole("button", { name: "Predict down" }).should("be.enabled");
    cy.findByRole("button", { name: "Predict down" }).should(
      "have.attr",
      "aria-disabled",
      "true"
    );
  });

  const predictionEvent: PredictionEvent = {
    payload: {
      gameId: gameId,
      prediction: "DOWN",
      userId: secondUserId,
    },
    type: "prediction",
  };
  cy.get("@subscription").invoke("listener", { value: predictionEvent });

  cy.findByTestId(`user-${secondUserId}-row`).within(() => {
    cy.findByRole("button", { name: "Predict up" }).should("be.disabled");
    cy.findByRole("button", { name: "Predict up" }).should(
      "have.attr",
      "aria-disabled",
      "true"
    );

    cy.findByRole("button", { name: "Predict down" }).should("be.enabled");
    cy.findByRole("button", { name: "Predict down" }).should(
      "have.attr",
      "aria-disabled",
      "true"
    );
  });

  /**
   * The UI updates when the second player disconnect
   */
  const disconnectionEvent: PresenceEvent = {
    payload: {
      ...connectionEvent.payload,
      status: "DISCONNECTED",
    },
    type: "presence",
  };

  cy.get("@subscription").invoke("listener", { value: disconnectionEvent });

  cy.findByRole("rowheader", { name: connectionEvent.payload.name }).should(
    "not.exist"
  );
});
