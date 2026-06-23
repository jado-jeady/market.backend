import db from "../models/index.js";
import { validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { getIO } from "../utils/socket.js";
import { generateToken } from "../utils/jwt.js"; // Adjust path as needed

const { User, Notification } = db;

export const register = async (req, res, next) => {
  try {
    // 1. Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { full_name, username, email, password, role, shop_name } = req.body;
    console.log(req.body.role + "this is the role");

    // 2. Check if username or email already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or Email already in use",
      });
    }

    /**
     * FIX: Pass the plain 'password' into 'password_hash'.
     * DO NOT use bcrypt.hash() here because your User model has a
     * 'beforeCreate' hook that will hash it for you.
     */
    const user = await User.create({
      full_name,
      username,
      email,
      password_hash: password, // The hook handles the hashing
      role: role || "Cashier",
      shop_name: shop_name || "masteryhub",
      is_active: true,
    });

    // 3. Generate Auth Token

    console.log(user.role + "this is the user role");
    const token = generateToken(user);
    // 4. Prepare response (excluding sensitive data)
    const userResponse = {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      shop_name: user.shop_name,
      is_active: user.is_active,
    };

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    // Pass unexpected errors to the global error handler
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { username } });
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Account is disabled or invalid credentials",
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken(user);

    // Prepare response object
    const userResponse = {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      shop_name: user.shop_name,
    };

    // Respond to client
    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        token,
      },
    });

    // --- Create & emit notification for Admins ---
    const notif = await Notification.create({
      message: `${user.full_name} logged in`,
      role: "Admin", // only admins should see this
      targetUrl: `/admin/management/users`, // optional: route to user management
      userId: user.id,
    });

    // Emit to Admin room with consistent event name
    getIO().to("Admin").emit("notification", notif);
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password_hash"] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
