import { authenticate } from "../../../server/src/authentication/perform-authentication";
import { TESTING_CONSTANTS } from "../setupFile";

describe("perform-authentication.ts", () => {
  describe("authenticate()", () => {
    it("should not allow logging in when given incorrect credentials", async () => {
      console.log(globalThis);

      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      const messages: Array<any> = [];

      await new Promise((resolve) => socket.addEventListener("open", resolve));
      socket.addEventListener("message", (event: any) => {
        messages.push(event.data);
      });

      await new Promise((resolve) => setTimeout(resolve, 17));

      const connectionIDMessage = messages.filter((message) => {
        const json = JSON.parse(message);
        return (
          json.message === "changeValueOfInput" &&
          json.selector === "#authentication-modal__socket-id"
        );
      })[0];

      const connectionID = JSON.parse(connectionIDMessage).value;

      expect(connectionID).toHaveLength(16);

      console.log(connectionID);

      const result = await authenticate("123", "456", connectionID);
      expect(result).toBe(false);
    });
  });
});
