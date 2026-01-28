import { Response } from "express";
import { AuthRequest } from "middleware/auth";

const fetchShowcase = async (req: AuthRequest, res: Response) => {
  try {
    // TODO: Will be replaced in the future updates
    // For now, return empty array
    return res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error("[SHOWCASE] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

const controllers = {
  fetchShowcase,
};

export default controllers;
