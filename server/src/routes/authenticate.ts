import express, { Request, Response } from "express";
import { authenticate } from "../authentication/perform-authentication";
import rateLimit from "express-rate-limit";
const bodyParser = require("body-parser");
const router = express.Router();
const jsonParser = bodyParser.json();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false
});

// authentication route
router.post(
  "/authenticate",
  limiter,
  jsonParser,
  async (request: Request, response: Response) => {
    const username = request.body["username"];
    const password = request.body["password"];
    const socketID = request.body["socketID"];
    const result = await authenticate(username, password, socketID);
    response.json({ success: result });
  }
);

export { router };
