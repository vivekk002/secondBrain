import mongoose from "mongoose";

const User = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
  },
  profilePicture: {
    type: String,
  },
  bio: {
    type: String,
  },
});

const Tag = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  contentId: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contant",
      required: true,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const contantTypes = ["youtube", "pdf", "doc", "image", "article"];

const Contant = new mongoose.Schema({
  link: {
    type: String,
    required: true,
    unique: true,
  },
  contentType: { type: String, enum: contantTypes, required: true },
  title: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  shareLink: { type: String },
  shareHash: { type: String },
  createdAt: { type: Date, default: Date.now },
  transcription: { type: String },
  vectorDB: { type: [Number] },
  aiChat: [
    {
      role: { type: String, enum: ["user", "model"], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  filePublicId: { type: String },
});

const linkSchema = new mongoose.Schema({
  hash: { type: String, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
});

export const UserModel = mongoose.model("User", User);
export const TagModel = mongoose.model("Tag", Tag);
export const ContantModel = mongoose.model("Contant", Contant);
export const LinkModel = mongoose.model("Link", linkSchema);
export default {
  UserModel,
  TagModel,
  ContantModel,
  LinkModel,
};
