// TODO: Rename this file so it can differentiate between global and room
type LeaderboardsChatMessage = {
  name: string;
  mode: string;
  score: string | number;
  apm: string | number;
  rank: string | number;
  enemiesKilled: string | number;
  enemiesSpawned: string | number;
  timeElapsed: string | number;
};

function createChatMessage(
  message: any,
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
  switch (attribute) {
    case "leaderboards": {
      // if (typeof message === "object") {
      const data = message;
      element.addClass("chat-tray__message--alert-score");
      const topDiv = $(`<div></div>`);
      topDiv.addClass("chat-tray__message-alert-score__top");
      topDiv.append(
        `<div style="color:${color}">${data.name}</div><div>${getMode(
          data.mode
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
      // }
      break;
    }
    default: {
      element.append(`<span style="color:${color}">${sender}</span>: `);
      element.append(`${message}`);
      break;
    }
  }
  return element;
}

export { createChatMessage };
