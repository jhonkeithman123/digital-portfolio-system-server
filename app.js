import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

import mainRoute from "./routes/default.js";
import auth from "./routes/auth.js";
import submission from "./routes/submissions.js";
import security from "./routes/security.js";
import classrooms from "./routes/classrooms.js";
import activityquizes from "./routes/activity&quizes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
    reportOnly: false,
  })
);

app.use("/", mainRoute);
app.use("/auth", auth);
app.use("/api", submission);
app.use("/security", security);
app.use("/classrooms", classrooms);
app.use("/quizes", activityquizes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`server running on port ${PORT}`));
