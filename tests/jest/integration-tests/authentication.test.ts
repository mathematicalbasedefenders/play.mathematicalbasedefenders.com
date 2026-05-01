import { authenticate } from "../../../server/src/authentication/perform-authentication";
import { TESTING_CONSTANTS } from "../setupFile";
import { wait } from "../wait";

function getConnectionIDOfSocket(messages: Array<any>) {
  const connectionIDMessage = messages.filter((message) => {
    const json = JSON.parse(message);
    return (
      json.message === "changeValueOfInput" &&
      json.selector === "#authentication-modal__socket-id"
    );
  })[0];

  const connectionID = JSON.parse(connectionIDMessage).value;
  return connectionID;
}

describe("perform-authentication.ts", () => {
  describe("authenticate()", () => {
    it("should allow logging in when given incorrect credentials", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      const messages: Array<any> = [];

      await new Promise((resolve) => socket.addEventListener("open", resolve));
      socket.addEventListener("message", (event: any) => {
        messages.push(event.data);
      });

      await wait(17);

      const connectionID = getConnectionIDOfSocket(messages);

      expect(connectionID).toHaveLength(16);

      const result = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        TESTING_CONSTANTS.TESTING_USER_PASSWORD,
        connectionID
      );
      expect(result).toBe(true);

      await wait(17);
    });

    it("should not allow logging in when given incorrect password", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      const messages: Array<any> = [];

      await new Promise((resolve) => socket.addEventListener("open", resolve));
      socket.addEventListener("message", (event: any) => {
        messages.push(event.data);
      });

      await wait(17);

      const connectionID = getConnectionIDOfSocket(messages);

      expect(connectionID).toHaveLength(16);

      const result = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        "12345688",
        connectionID
      );
      expect(result).toBe(false);

      await wait(17);
    });
  });
});
