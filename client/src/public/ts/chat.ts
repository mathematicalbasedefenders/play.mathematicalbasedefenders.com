// TODO: Rename this file so it can differentiate between global and room
function createChatMessage(
  message: string,
  sender: string,
  attribute?: string
) {
  // default: "#chat-tray-message-container";
  const element = $("<div></div>");
  element.addClass("chat-tray__message");
  switch (attribute) {
    default: {
      element.text(`${sender}: ${message}`);
      break;
    }
  }
  return element;
}

export { createChatMessage };
