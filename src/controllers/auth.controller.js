import db from '../models/index.js';
import { generateToken } from '../utils/jwt.js';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

const { User } = db;

export const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { full_name, username, email, password, role } = req.body;

    // Check if username exists
    const existingUser = await User.findOne({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      full_name,
      username,
      email,
      password_hash,
      role: role || 'Cashier',
      is_active: true
    });

    const token = generateToken(user);

    const userResponse = {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    next(error);
  }
};



export const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { username, password } = req.body;


    const user = await User.findOne({
      where: { username }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is disabled or invalid credentials'
      });
    }
    
    console.log(`username before ${username} password ${password}`);
    const isValidPassword = await user.comparePassword(password);
    console.log("compare password Out PUT:"+isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken(user);

    const userResponse = {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    next(error);
  }
};



export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};