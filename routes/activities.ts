import express from "express";
import wrapAsync from "utils/wrapAsync";
import { verifyToken } from "middleware/auth";
import controller, { upload } from "controllers/activities";

const router = express.Router();

// Activity routes
router
  .route("/:id")
  .all(verifyToken)
  .get(wrapAsync(controller.getActivityById))
  .delete(wrapAsync(controller.deleteActivity));

// Comments routes
router
  .route("/:id/comments")
  .all(verifyToken)
  .get(wrapAsync(controller.getActivityComments))
  .post(wrapAsync(controller.createComment));

router.delete(
  "/:id/comments/:commentId",
  verifyToken,
  wrapAsync(controller.deleteComment),
);

// Replies routes
router.post(
  "/:id/comments/:commentId/replies",
  verifyToken,
  wrapAsync(controller.createReply),
);

router.delete(
  "/:id/comments/:commentId/replies/:replyId",
  verifyToken,
  wrapAsync(controller.deleteReply),
);

// Create activity
router.post(
  "/create",
  verifyToken,
  upload.single("file"),
  wrapAsync(controller.createActivity),
);

// Classroom activities
router.get(
  "/classroom/:code",
  verifyToken,
  wrapAsync(controller.getClassroomActivities),
);

// Submissions
router.post(
  "/:id/submit",
  verifyToken,
  upload.single("file"),
  wrapAsync(controller.submitActivity),
);

router.get(
  "/:id/my-submission",
  verifyToken,
  wrapAsync(controller.getMySubmission),
);

router.get(
  "/:id/submissions",
  verifyToken,
  wrapAsync(controller.getActivitySubmissions),
);

router.delete(
  "/:id/submission/:submissionId",
  verifyToken,
  wrapAsync(controller.deleteSubmission),
);

router.patch(
  "/:id/submissions/:submissionId/score",
  verifyToken,
  wrapAsync(controller.gradeSubmission),
);

// Instructions
router.patch(
  "/:id/instructions",
  verifyToken,
  wrapAsync(controller.updateInstructions),
);

router.put(
  "/:id/instructions/:instructionId",
  verifyToken,
  wrapAsync(controller.editInstruction),
);

// Edit comments
router.patch(
  "/:id/comments/:commentId",
  verifyToken,
  wrapAsync(controller.editComment),
);

export default router;
