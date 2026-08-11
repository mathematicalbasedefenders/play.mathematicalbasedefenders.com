import mongoose from "mongoose";
import { User } from "../../server/src/models/User";
import { TESTING_CONSTANTS } from "./constants";

function waitForWebSocketMessage(
  socket: WebSocket,
  predicate: (...args: any[]) => boolean,
  timeout = 1000
) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeEventListener("message", listener);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("WebSocket message timeout reached."));
    }, timeout);

    function listener(event: MessageEvent) {
      const message = JSON.parse(event.data);
      if (predicate(message)) {
        cleanup();
        resolve(message);
      }
    }
    socket.addEventListener("message", listener);
  });
}

async function openTestSocket() {
  const socket = new WebSocket(
    `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`
  );
  const connectionIDMessage = waitForWebSocketMessage(
    socket,
    (data: { [key: string]: unknown }) =>
      data.message === "changeValueOfInput" &&
      data.selector === "#authentication-modal__socket-id"
  );

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Socket failed to open.")),
      { once: true }
    );
  });

  const message = (await connectionIDMessage) as { value: string };
  return { socket, connectionID: message.value };
}

function waitForWebSocketClose(socket: WebSocket, timeout = 1000) {
  return new Promise<CloseEvent>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("WebSocket close timeout reached.")),
      timeout
    );
    socket.addEventListener(
      "close",
      (event) => {
        clearTimeout(timer);
        resolve(event);
      },
      { once: true }
    );
  });
}

function sendProtocolMessage(
  socket: WebSocket,
  message: { [key: string]: any }
) {
  socket.send(JSON.stringify({ message }));
}

async function requestJSON(path: string, init?: RequestInit) {
  const response = await fetch(
    `http://localhost:${TESTING_CONSTANTS.TESTING_WEB_SERVER_PORT}${path}`,
    init
  );
  const body = await response.json();
  return { response, body };
}

async function createTestUser(overrides: { [key: string]: any } = {}) {
  const username =
    overrides.username ?? TESTING_CONSTANTS.TESTING_USER_USERNAME;
  const user = new User({
    username,
    usernameInAllLowercase: username.toLowerCase(),
    emailAddress: "test@example.com",
    hashedPassword: "hashed-test-password",
    userNumber: 1,
    creationDateAndTime: new Date("2024-01-01T00:00:00.000Z"),
    statistics: {
      gamesPlayed: 0,
      totalExperiencePoints: 0,
      personalBestScoreOnEasySingleplayerMode: {
        score: 0,
        timeInMilliseconds: 0,
        scoreSubmissionDateAndTime: new Date(0),
        actionsPerformed: 0,
        enemiesKilled: 0,
        enemiesCreated: 0
      },
      personalBestScoreOnStandardSingleplayerMode: {
        score: 0,
        timeInMilliseconds: 0,
        scoreSubmissionDateAndTime: new Date(0),
        actionsPerformed: 0,
        enemiesKilled: 0,
        enemiesCreated: 0
      },
      multiplayer: {
        gamesPlayed: 0,
        gamesWon: 0
      }
    },
    membership: {
      isDeveloper: false,
      isAdministrator: false,
      isModerator: false,
      isContributor: false,
      isTester: false,
      isDonator: false,
      specialRank: ""
    }
  });

  if (overrides.statistics) {
    const currentStatistics = user.statistics.toObject();
    user.set("statistics", {
      ...currentStatistics,
      ...overrides.statistics,
      personalBestScoreOnEasySingleplayerMode: {
        ...currentStatistics.personalBestScoreOnEasySingleplayerMode,
        ...overrides.statistics.personalBestScoreOnEasySingleplayerMode
      },
      personalBestScoreOnStandardSingleplayerMode: {
        ...currentStatistics.personalBestScoreOnStandardSingleplayerMode,
        ...overrides.statistics.personalBestScoreOnStandardSingleplayerMode
      },
      multiplayer: {
        ...currentStatistics.multiplayer,
        ...overrides.statistics.multiplayer
      }
    });
  }
  if (overrides.membership) {
    user.set("membership", {
      ...user.membership.toObject(),
      ...overrides.membership
    });
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (key !== "statistics" && key !== "membership") {
      user.set(key, value);
    }
  }
  return await user.save();
}

function createFakeSocket(overrides: { [key: string]: any } = {}) {
  const sentMessages: Array<any> = [];
  const publishedMessages: Array<{ channel: string; message: any }> = [];
  const subscriptions: Array<string> = [];
  const unsubscriptions: Array<string> = [];
  const toastNotifications: Array<any> = [];
  const calls = {
    close: 0,
    end: 0,
    forceTeardown: 0,
    teardown: 0
  };
  const userData = {
    connectionID: "TESTCONNECTION01",
    ownerGuestName: "Guest 00000001",
    ownerUsername: "test_user1",
    ownerUserID: null,
    loggedIn: false,
    exitedOpeningScreen: true,
    playerRank: { title: "", color: "#ffffff" },
    accumulatedMessages: 0,
    rateLimiting: { last: 0, count: 0 },
    forceTeardown() {
      calls.forceTeardown++;
      return true;
    },
    teardown() {
      calls.teardown++;
      return true;
    },
    sendToastNotification(data: any) {
      toastNotifications.push(data);
    },
    ...overrides
  };
  const socket = {
    getUserData: () => userData,
    send: (message: string) => {
      try {
        sentMessages.push(JSON.parse(message));
      } catch {
        sentMessages.push(message);
      }
    },
    subscribe: (channel: string) => subscriptions.push(channel),
    unsubscribe: (channel: string) => unsubscriptions.push(channel),
    publish: (channel: string, message: string) => {
      try {
        publishedMessages.push({ channel, message: JSON.parse(message) });
      } catch {
        publishedMessages.push({ channel, message });
      }
    },
    close: () => {
      calls.close++;
    },
    end: () => {
      calls.end++;
    }
  } as any;
  return {
    socket,
    sentMessages,
    publishedMessages,
    subscriptions,
    unsubscriptions,
    toastNotifications,
    calls,
    userData
  };
}

function objectID() {
  return new mongoose.Types.ObjectId();
}

export {
  waitForWebSocketMessage,
  waitForWebSocketClose,
  openTestSocket,
  sendProtocolMessage,
  requestJSON,
  createTestUser,
  createFakeSocket,
  objectID
};
