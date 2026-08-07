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
    lowercase: true,
    trim: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
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

// Tags are per-user: the same tag name is allowed across different users,
// but must be unique within one user's own tag list.
Tag.index({ name: 1, userId: 1 }, { unique: true });

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

const blacklistedTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  // TTL index: MongoDB automatically deletes the document once expiresAt
  // passes, which is set to the token's own JWT expiry - no unbounded growth.
  expiresAt: { type: Date, required: true },
});
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserModel = mongoose.model("User", User);
export const TagModel = mongoose.model("Tag", Tag);
export const ContantModel = mongoose.model("Contant", Contant);
export const LinkModel = mongoose.model("Link", linkSchema);
export const BlacklistedTokenModel = mongoose.model(
  "BlacklistedToken",
  blacklistedTokenSchema,
);
export default {
  UserModel,
  TagModel,
  ContantModel,
  LinkModel,
  BlacklistedTokenModel,
};


const refreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  revoked: { type: Boolean, default: false }
})
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })


export const RefreshTokenModel = mongoose.model("RefreshToken", refreshTokenSchema)
