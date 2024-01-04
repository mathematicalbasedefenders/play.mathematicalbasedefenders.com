import fetch from "node-fetch";
import { GameData } from "../game/GameData";
import { log } from "../core/log";

function sendDiscordWebhook(data: GameData) {
  if (!process.env.DISCORD_WEBHOOK_URL) {
    log.warn("No Discord Webhook URL found, not sending webhook.");
    return;
  }
  log.info("Sending webhook to Discord server...");
}

export { sendDiscordWebhook };
