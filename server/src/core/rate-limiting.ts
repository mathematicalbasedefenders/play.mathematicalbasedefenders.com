import { GameWebSocket, UserData } from "../universal";
import { log } from "./log";

// https://github.com/uNetworking/uWebSockets.js/issues/335#issuecomment-643500581
// https://github.com/uNetworking/uWebSockets.js/issues/335#issuecomment-834141711
const WebSocketRateLimit = (limit: number, interval: number) => {
  return (socket: GameWebSocket<UserData>) => {
    const socketUserData = socket.getUserData();
    if (Date.now() > socketUserData.rateLimiting.last + interval) {
      socketUserData.rateLimiting.count = 0;
    }
    if (socketUserData.rateLimiting.count === 0) {
      socketUserData.rateLimiting.last = Date.now();
    }
    if (!socketUserData.rateLimiting) {
      return false;
    }
    return ++socketUserData.rateLimiting.count > limit;
  };
};

function rateLimitSocket(socket: GameWebSocket<UserData>) {
  const socketID = socket.getUserData().connectionID;

  const MESSAGE = `You're going too fast! You have rate-limited and been disconnected.`;
  const BORDER_COLOR = "#ff0000";

  const data = {
    borderColor: BORDER_COLOR,
    text: MESSAGE
  };

  socket.getUserData().sendToastNotification(data);
  socket.getUserData().forceTeardown();

  log.warn(`Rate-limited and killing socket ${socketID}.`);

  return;
}

export { WebSocketRateLimit, rateLimitSocket };
