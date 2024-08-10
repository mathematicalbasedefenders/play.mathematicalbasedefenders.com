function createChatMessage(
  message: { [key: string]: string | number },
  sender: string,
  color: string,
  attribute?: string
) {
  function getMode(mode: string) {
    switch (mode) {
      case "easySingleplayer": {
        return "Easy Singleplayer";
      }
      case "standardSingleplayer": {
        return "Standard Singleplayer";
      }
      default: {
        return "???";
      }
    }
  }
  // default: "#chat-tray-message-container";
  const element = $("<div></div>");
  element.addClass("chat-tray__message");
  const data = message;
  switch (attribute) {
    case "leaderboards": {
      element.addClass("chat-tray__message--alert-score");
      const topDiv = $(`<div></div>`);
      topDiv.addClass("chat-tray__message-alert-score__top");
      topDiv.append(
        `<div style="color:${color}">${data.name}</div><div>${getMode(
          data.mode as string
        )}</div>`
      );
      const middleDiv = $(`<div></div>`);
      middleDiv.addClass("chat-tray__message-alert-score__middle");
      middleDiv.text(`${data.score}`);
      const bottomDiv = $(`<div></div>`);
      bottomDiv.addClass("chat-tray__message-alert-score__bottom");
      bottomDiv.append(
        `#${data.rank}, ${data.timeElapsed}ms, ${data.apm}APM, ${data.enemiesKilled}/${data.enemiesSpawned}`
      );
      element.append(topDiv);
      element.append(middleDiv);
      element.append(bottomDiv);
      break;
    }
    default: {
      element.append(`<span style="color:${color}">${data.sender}</span>: `);
      element.append(`${data.message}`);
      break;
    }
  }
  return element;
}

export { createChatMessage };
