import { TESTING_CONSTANTS } from "../../setupFile";
import { wait } from "../../wait";

describe("SingleplayerRoom", () => {
  it("should create a room once the constructor is called", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    const messages: Array<any> = [];

    await new Promise((resolve) => socket.addEventListener("open", resolve));
    socket.addEventListener("message", (event: any) => {
      messages.push(event.data);
    });

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const createRoomMessage = {
      message: { message: "startGame", mode: "singleplayer", modifier: "easy" }
    };

    socket.send(JSON.stringify(exitOpeningScreenMessage));
    socket.send(JSON.stringify(createRoomMessage));

    await wait(TESTING_CONSTANTS.WEBSOCKET_UPDATE_DELAY_TIME);

    expect((globalThis as any).rooms).not.toBeFalsy();
    expect((globalThis as any).rooms).toHaveLength(1);
  });
});
