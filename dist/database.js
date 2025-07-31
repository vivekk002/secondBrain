"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkModel = exports.ContantModel = exports.TagModel = exports.UserModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const User = new mongoose_1.default.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
});
const tagScema = new mongoose_1.default.Schema({
    title: {
        type: String,
        required: true,
        unique: true,
    },
});
const contantTypes = ["image", "article", "link", "audio"];
const Contant = new mongoose_1.default.Schema({
    link: {
        type: String,
        required: true,
        unique: true,
    },
    type: { type: String, enum: contantTypes, required: true },
    title: { type: String, required: true },
    tags: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Tag" }],
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true },
});
const linkSchema = new mongoose_1.default.Schema({
    hash: { type: String, required: true },
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true },
});
exports.UserModel = mongoose_1.default.model("User", User);
exports.TagModel = mongoose_1.default.model("Tag", tagScema);
exports.ContantModel = mongoose_1.default.model("Contant", Contant);
exports.LinkModel = mongoose_1.default.model("Link", linkSchema);
exports.default = {
    UserModel: exports.UserModel,
    TagModel: exports.TagModel,
    ContantModel: exports.ContantModel,
    LinkModel: exports.LinkModel,
};
// This file defines the database schemas and models for the application using Mongoose.
// It includes schemas for User, Tag, Contant, and Link, each with their respective fields and relationships.
