import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import mainRoute from "./routes/default.js";
import auth from "./routes/auth.js";
import submission from "./routes/submissions.js";
import security from "./routes/security.js";
import classrooms from "./routes/classrooms.js";
import quizzes from "./routes/quizzes.js";
import activities from "./routes/activities.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const client_url = process.env.CLIENT_ORIGIN || "ttp://localhost:3000";

app.use(
  cors({
    origin: client_url,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(cookieParser());

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", client_url],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginEmbedderPolicy: false,
  })
);

app.use("/", mainRoute);
app.use("/auth", auth);
app.use("/api", submission);
app.use("/security", security);
app.use("/classrooms", classrooms);
app.use("/quizzes", quizzes);
app.use("/activity", activities);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`server running on port ${PORT}`));
