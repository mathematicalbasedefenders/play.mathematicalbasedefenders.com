import { WebSocket, UserData } from "../../universal";

/**
 * Changes text rendered on client side through a WebSocket/WebSocket<UserData> message.
 * @param {WebSocket<UserData>} socket The socket to change text data of.
 * @param {string} selector The client-side selector
 * @param {string} value The new text
 */
function changeClientSideText(
  socket: WebSocket<UserData>,
  selector: string,
  value: string
) {
  const toSend = JSON.stringify({
    message: "changeText",
    selector: selector,
    value: value
  });
  socket.send(toSend);
}

/**
 * Changes HTML rendered on client side through a WebSocket/WebSocket<UserData> message.
 * This should not be used in most cases: instead use the `changeClientSideText`
 * if you only want to change text (and not styling).
 * @param {WebSocket<UserData>} socket The socket to change text data of.
 * @param {string} selector The client-side selector
 * @param {string} value The new HTML
 */
function changeClientSideHTML(
  socket: WebSocket<UserData>,
  selector: string,
  value: string
) {
  const toSend = JSON.stringify({
    message: "changeHTML",
    selector: selector,
    value: value
  });
  socket.send(toSend);
}

export { changeClientSideText, changeClientSideHTML };
