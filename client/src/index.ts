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
app.set("trust proxy", 2);

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
        "img-src": ["https:", "data:", "'self'"],
        "style-src": [
          "'unsafe-inline'",
          "'self'",
          "fonts.googleapis.com",
          "cdn.jsdelivr.net"
        ],
        "connect-src": [
          "http://localhost:4000",
          "https://play.mathematicalbasedefenders.com:4000",
          "ws://localhost:5000",
          "wss://play.mathematicalbasedefenders.com:5000",
          "'self'",
          "data:"
        ],
        "form-action": [
          "'self'",
          "http://localhost:4000/api/authenticate",
          "https://play.mathematicalbasedefenders.com:4000/api/authenticate"
        ],
        "worker-src": ["'self'", "blob:"]
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
  const isProduction = process.env.NODE_ENV === "production";
  response.render("pages/index.ejs", { optimizeForProduction: isProduction });
});

app.all("*", limiter, (request: Request, response: Response) => {
  response.status(404).render("pages/404.ejs");
});

app.listen(PORT, () => {
  const version = process.env.npm_package_version;
  log.info(`Mathematical Base Defenders ${version} (client-side code)`);
  log.info(`Client app listening at port ${PORT}`);
  if (process.env.CREDENTIAL_SET_USED === "TESTING") {
    log.warn("Using testing credentials.");
  }
  if (process.env.NODE_ENV === "production") {
    log.info("Using NODE_ENV=production.");
    log.info("If not on production, set it to something else.");
  } else {
    log.warn("Environment variable NODE_ENV is not set to production.");
    log.warn("Using testing configurations.");
  }
});
