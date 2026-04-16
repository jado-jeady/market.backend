import { verifyToken } from "../utils/jwt.js";

export const authenticate = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    console.log(token);
    console.log(
      "===========================token above=======================================",
    );

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.sdsdsd",
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.error({
      message: "error during authentication",
      error: error.message,
    });
    return res.status(401).json({
      success: false,
      message: "Invalid tokebbbbbbbn.",
      error: error.message,
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      console.log("this is a us" + req.user.role);
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission.",
      });
    }
    next();
  };
};
