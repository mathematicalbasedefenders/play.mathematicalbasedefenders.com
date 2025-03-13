import express, { Request, Response } from "express";
import { authenticate } from "../authentication/perform-authentication";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
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
  "/api/authenticate",
  limiter,
  jsonParser,
  async (request: Request, response: Response) => {
    if (!request.body || typeof request.body !== "object") {
      return response
        .status(400)
        .json({ success: false, error: "Invalid request body" });
    }

    const username = request.body["username"];
    const password = request.body["password"];
    const socketID = request.body["socketID"];

    // Validate required fields
    if (!username || !password || !socketID) {
      return response
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    // Validate input format
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof socketID !== "string"
    ) {
      return response
        .status(400)
        .json({ success: false, error: "Invalid field types" });
    }

    // Validate input length
    if (username.length < 3 || username.length > 20 || password.length < 8) {
      return response
        .status(400)
        .json({ success: false, error: "Invalid field lengths" });
    }

    try {
      const result = await authenticate(username, password, socketID);
      response.json({ success: result, error: "None" });
    } catch (error) {
      console.error("Authentication error:", error);
      response.status(401).json({
        success: false,
        error: "Authentication failed"
      });
    }
  }
);

export { router };
