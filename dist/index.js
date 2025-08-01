"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
require("dotenv").config();
const database_1 = require("./database");
const middleware_1 = __importDefault(require("./middleware"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = "vivek054054"; // Ideally, this should be stored in an environment variable
mongoose_1.default
    .connect("mongodb+srv://vivek054:vivek054054@cluster0.hyhgqop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("Connected to MongoDB!"))
    .catch((err) => console.error(err));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//password hashing function
const saltRounds = 16; // Increasing this improves security but slows hashing
const password = "user_password";
function hashPassword(password) {
    return __awaiter(this, void 0, void 0, function* () {
        const hash = yield bcrypt_1.default.hash(password, saltRounds);
        return hash;
    });
}
//zod validation schema
const userSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "Username is required"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
});
//generate JWT token
function generateToken(userId) {
    // You can include other claims in the payload as needed
    const payload = { id: userId };
    // Generate a token valid for 1 hour (3600 seconds)
    const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: "1h" });
    return token;
}
//SignUp routes
app.post("/api/v1/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    const validation = userSchema.safeParse({ username, password });
    if (!validation.success) {
        return res.status(400).json({
            error: validation.error.message,
            issues: validation.error.issues,
        });
    }
    // Check if user already exists
    const existingUser = yield database_1.UserModel.findOne({ username });
    if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
    }
    // Hash the password before saving
    const hashedPassword = yield hashPassword(password); // Ideally, you should hash the password before saving
    // Create a new user
    yield database_1.UserModel.create({ username: username, password: hashedPassword });
    // Logic to handle user signup
    res.status(201).json({
        data: { username, password: hashedPassword },
        message: "User signed up successfully",
    });
    console.log("User signed up:", username);
    console.log("Hashed password:", hashedPassword);
}));
//SignIn routes
app.post("/api/v1/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    const validation = userSchema.safeParse({ username, password });
    if (!validation.success) {
        return res.status(400).json({
            error: validation.error.message,
            issues: validation.error.issues,
        });
    }
    // Find the user by username
    const user = yield database_1.UserModel.find({ username });
    if (!user || user.length === 0) {
        return res.status(404).json({ error: "User not found" });
    }
    // Compare the provided password with the stored hashed password
    const isPasswordValid = yield bcrypt_1.default.compare(password, user[0].password);
    if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid password" });
    }
    else {
        const token = generateToken(user[0]._id.toString());
        console.log("Generated JWT Token:", token);
    }
    // Logic to handle user sign-in
    res.status(200).json({
        data: { username: user[0].username },
        message: "User signed in successfully",
    });
    console.log("User signed in:", user[0].username);
}));
//Add new content routes
app.post("/api/v1/content", middleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { link, type, title } = req.body;
    // Create a new content entry
    const newContent = yield database_1.ContantModel.create({
        link,
        type,
        title,
        //@ts-ignore
        userId: req.userId,
        tags: [], // Assuming req.userId is set by middleware
        // Assuming req.userId is set by middleware
    });
    console.log("New content added:", newContent);
    res.status(201).json({
        data: newContent,
        message: "Content added successfully",
    });
}));
//Get all content routes
app.get("/api/v1/content", middleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Logic to handle fetching all content
    //@ts-ignore
    const contents = yield database_1.ContantModel.find({ userId: req.userId }).populate("userId", "username");
    res.status(200).json({
        data: contents,
        message: "Content fetched successfully",
    });
}));
//Delete content by ID routes
app.delete("/api/v1/content/:contentId", middleware_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const contentId = req.params.contentId;
    if (!contentId) {
        return res.status(400).json({ error: "Content ID is required" });
    }
    try {
        const content = yield database_1.ContantModel.findOneAndDelete({
            _id: contentId,
            //@ts-ignore
            userId: req.userId,
        });
    }
    catch (error) {
        console.error("Error deleting content:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
    res.status(200).json({
        message: "Content deleted successfully",
    });
    console.log("Content deleted:", contentId);
}));
//Get a sharable link by ID routes
app.get("/api/v1/brain/share", (req, res) => __awaiter(void 0, void 0, void 0, function* () { }));
//Get sharable links routes
app.get("/api/v1/brain/:sharelink", (req, res) => __awaiter(void 0, void 0, void 0, function* () { }));
exports.default = app;
