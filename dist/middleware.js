"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = "vivek054054"; // Ideally, this should be stored in an environment variable
const middleware = (req, res, next) => {
    // Middleware logic can be added here
    const header = req.headers["authorization"];
    if (!header) {
        return res.status(401).json({ error: "Authorization header missing" });
    }
    // Assuming the format
    try {
        const validToken = jsonwebtoken_1.default.verify(header, JWT_SECRET);
        // Attach the user id to request object (make sure type declaration exists)
        req.userId = validToken.id;
        next();
    }
    catch (err) {
        res.status(403).json({ error: "Invalid or expired token" });
    }
};
exports.default = middleware;
