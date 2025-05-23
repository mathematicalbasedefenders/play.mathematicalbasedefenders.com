import fetch from "node-fetch";
import { GameData, GameMode } from "../game/GameData";
import { log } from "../core/log";
import { millisecondsToTime } from "../core/utilities";

const WEBHOOK_USERNAME = "Mathematical Base Defenders Leaderboards Watcher";

function sendDiscordWebhook(data: GameData, rank: number, replayID: string) {
  const parameters: { [key: string]: any } = {};
  const apm = ((data.actionsPerformed / data.elapsedTime) * 60000).toFixed(3);
  const time = millisecondsToTime(data.elapsedTime);
  const spawned = data.enemiesSpawned.toLocaleString("en-US");
  const killed = data.enemiesKilled.toLocaleString("en-US");
  const score = data.score.toLocaleString("en-US");
  parameters.username = WEBHOOK_USERNAME;
  let modeName;
  if (!process.env.DISCORD_WEBHOOK_URL) {
    log.warn("No Discord Webhook URL found, not sending webhook.");
    return;
  }
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      modeName = "Easy Singleplayer";
      break;
    }
    case GameMode.StandardSingleplayer: {
      modeName = "Standard Singleplayer";
      break;
    }
  }
  log.info("Sending webhook to Discord server...");
  if (rank == 1) {
    // Rank 1: Extremely Special World Record Message
    parameters.embeds = [
      {
        "title": `WORLD RECORD!!!`,
        "color": 0xffd700
      },
      {
        "title": `${data.ownerName} placed #${rank} on the ${modeName} leaderboards with a score of ${score} points.`,
        "description": `survived for ${time}, killed ${killed}/${spawned} enemies at ${apm}APM.\nWatch the replay of this game by using Replay ID \`${replayID}\`.`,
        "color": 0xffd700
      }
    ];
  } else if (rank == 2) {
    // Rank 2: Super Special Embed
    parameters.embeds = [
      {
        "title": `${data.ownerName} placed #${rank} on the ${modeName} leaderboards with a score of ${score} points.`,
        "description": `survived for ${time}, killed ${killed}/${spawned} enemies at ${apm}APM.\nWatch the replay of this game by using Replay ID \`${replayID}\`.`,
        "color": 0xc0c0c0
      }
    ];
  } else if (rank == 3) {
    // Rank 3: Super Special Embed
    parameters.embeds = [
      {
        "title": `${data.ownerName} placed #${rank} on the ${modeName} leaderboards with a score of ${score} points.`,
        "description": `survived for ${time}, killed ${killed}/${spawned} enemies at ${apm}APM.\nWatch the replay of this game by using Replay ID \`${replayID}\`.`,
        "color": 0xcd7f32
      }
    ];
  } else if (rank <= 10) {
    // Up to Rank 10: Embed Message
    parameters.embeds = [
      {
        "title": `${
          data.ownerName
        } placed #${rank} on the ${modeName} leaderboards with a score of ${data.score.toLocaleString(
          "en-US"
        )} points.`,
        "description": `Watch the replay of this game by using Replay ID \`${replayID}\`.`,
        "color": 0x8b1ed
      }
    ];
  } else if (rank <= 100) {
    // Up to Rank 100: Regular Message
    parameters.content = `${
      data.ownerName
    } placed #${rank} on the ${modeName} leaderboards with a score of ${data.score.toLocaleString(
      "en-US"
    )} points.\nWatch the replay of this game by using Replay ID \`${replayID}\`.`;
  }
  fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-type": "application/json"
    },
    body: JSON.stringify(parameters)
  });
}

export { sendDiscordWebhook };
