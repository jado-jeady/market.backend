import express from "express";
import {
  createNotification,
  getNotifications,
  markNotificationRead,
  deleteNotification,
} from "../controllers/notifications.controller.js";

const router = express.Router();

// POST /notifications → create new notification
router.post("/", createNotification);

// GET /notifications?role=Admin → fetch notifications by role
router.get("/", getNotifications);

// PATCH /notifications/:id/read → mark as read
router.patch("/:id/read", markNotificationRead);

// DELETE /notifications/:id → delete notification
router.delete("/:id", deleteNotification);

export default router;
