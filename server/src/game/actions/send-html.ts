import { GameSocket } from "../../universal";

function changeClientSideText(
  socket: GameSocket,
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

function changeClientSideHTML(
  socket: GameSocket,
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
