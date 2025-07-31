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
});

const tagScema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
  },
});

const contantTypes = ["image", "article", "link", "audio"];

const Contant = new mongoose.Schema({
  link: {
    type: String,
    required: true,
    unique: true,
  },
  type: { type: String, enum: contantTypes, required: true },
  title: { type: String, required: true },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const linkSchema = new mongoose.Schema({
  hash: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

export const UserModel = mongoose.model("User", User);
export const TagModel = mongoose.model("Tag", tagScema);
export const ContantModel = mongoose.model("Contant", Contant);
export const LinkModel = mongoose.model("Link", linkSchema);
export default {
  UserModel,
  TagModel,
  ContantModel,
  LinkModel,
};
// This file defines the database schemas and models for the application using Mongoose.
// It includes schemas for User, Tag, Contant, and Link, each with their respective fields and relationships.
