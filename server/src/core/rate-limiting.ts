import { GameWebSocket, UserData } from "../universal";

// https://github.com/uNetworking/uWebSockets.js/issues/335#issuecomment-643500581
// https://github.com/uNetworking/uWebSockets.js/issues/335#issuecomment-834141711
const WebSocketRateLimit = (limit: number, interval: number) => {
  let now = 0;
  // const last = Symbol() as unknown as string;
  // const count = Symbol() as unknown as string;
  setInterval(() => ++now, interval);
  return (socket: GameWebSocket<UserData>) => {
    const socketUserData = socket.getUserData();
    if (!socketUserData.rateLimiting) {
      return;
    }
    if (socketUserData.rateLimiting.last != now) {
      socketUserData.rateLimiting.last = now;
      socketUserData.rateLimiting.count = 1;
    } else {
      return ++socketUserData.rateLimiting.count > limit;
    }
  };
};

export { WebSocketRateLimit };
