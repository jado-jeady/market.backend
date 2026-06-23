import { getIO } from "../utils/socket.js";
import db from "../models/index.js";

const { Notification, User } = db;
// CREATE notification (usually called inside other controllers)
export const createNotification = async (req, res) => {
  try {
    const { message, role, targetUrl } = req.body;
    const userId = req.user?.id; // who triggered it

    const notif = await Notification.create({
      message,
      role,
      targetUrl,
      userId,
    });

    // Emit to correct role room
    getIO().to(role).emit("notification", notif);

    res.status(201).json({
      success: true,
      message: "Notification created",
      data: notif,
    });
  } catch (error) {
    console.error("Create Notification Error:", error);
    res.status(500).json({ message: "Failed to create notification" });
  }
};

// GET notifications by role
export const getNotifications = async (req, res) => {
  try {
    const { role } = req.query;

    const notifs = await Notification.findAll({
      where: { role },
      include: [
        { model: User, as: "user", attributes: ["id", "full_name", "role"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(notifs);
  } catch (error) {
    console.error("Fetch Notifications Error:", error);
    res.status(500).json({ message: "Failed to retrieve notifications" });
  }
};

// PATCH mark notification as read
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findByPk(id);

    if (!notif) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notif.read = true;
    await notif.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notif,
    });
  } catch (error) {
    console.error("Mark Read Error:", error);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
};

// OPTIONAL: delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findByPk(id);

    if (!notif) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await notif.destroy();
    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Delete Notification Error:", error);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};
