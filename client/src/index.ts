import express, { Request, Response } from "express";
import { log } from "./log";
import path from "path";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
const app = express();
const PORT = 3000;
const helmet = require("helmet");
const favicon = require("serve-favicon");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": [
          "'self'",
          "code.jquery.com",
          "cdnjs.cloudflare.com",
          "cdn.jsdelivr.net",
          "pixijs.download",
          "'unsafe-eval'"
        ],
        "style-src": ["'unsafe-inline'", "*"],
        "connect-src": [
          "http://localhost:4000",
          "https://play.mathematicalbasedefenders.com:4000",
          "ws://localhost:5000",
          "wss://play.mathematicalbasedefenders.com:5000",
          "'self'"
        ]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(favicon(path.join(__dirname, "/public/assets/images/favicon.ico")));
app.use(express.static(path.join(__dirname, "/public/")));
app.use(bodyParser.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/", limiter, (request: Request, response: Response) => {
  response.render("pages/index.ejs");
});
app.listen(PORT, () => {
  log.info(`Server listening at port ${PORT}`);
  if (process.env.credentialSetUsed === "TESTING") {
    log.warn("Using testing credentials.");
  }
});
