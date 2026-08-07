import request from "supertest";

// Placed before importing `app` so the mock is registered before anything
// requires the real modules transitively (contentRoutes -> utils/ai etc).
jest.mock("../utils/extraction", () => ({
  extractContent: jest.fn().mockResolvedValue("mocked extracted text content"),
}));
jest.mock("../utils/ai", () => ({
  generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  chatWithAI: jest.fn().mockResolvedValue("mocked AI answer"),
}));

import app from "../app";

const signupAndSignin = async (username: string): Promise<string> => {
  await request(app)
    .post("/api/v1/signup")
    .send({ name: "Test", username, password: "password123" });
  const res = await request(app)
    .post("/api/v1/signin")
    .send({ username, password: "password123" });
  return res.body.token as string;
};

describe("Content routes", () => {
  it("creates content and returns it in the owner's list", async () => {
    const token = await signupAndSignin("contentuser1");

    const createRes = await request(app)
      .post("/api/v1/content")
      .set("Authorization", token)
      .field("title", "Test Article")
      .field("contentType", "article")
      .field("link", "https://example.com/article")
      .field("tags", "work");

    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get("/api/v1/content")
      .set("Authorization", token);

    expect(listRes.status).toBe(200);
    expect(listRes.body.contents).toHaveLength(1);
    expect(listRes.body.contents[0].title).toBe("Test Article");
    expect(listRes.body.tags).toHaveLength(1);
    expect(listRes.body.tags[0].name).toBe("work");
  });

  it("does not leak one user's content or tags to another user", async () => {
    const tokenA = await signupAndSignin("contentuserA");
    const tokenB = await signupAndSignin("contentuserB");

    await request(app)
      .post("/api/v1/content")
      .set("Authorization", tokenA)
      .field("title", "A's Article")
      .field("contentType", "article")
      .field("link", "https://example.com/a")
      .field("tags", "shared-tag-name");

    await request(app)
      .post("/api/v1/content")
      .set("Authorization", tokenB)
      .field("title", "B's Article")
      .field("contentType", "article")
      .field("link", "https://example.com/b")
      .field("tags", "shared-tag-name");

    const listA = await request(app)
      .get("/api/v1/content")
      .set("Authorization", tokenA);

    expect(listA.body.contents).toHaveLength(1);
    expect(listA.body.contents[0].title).toBe("A's Article");
    // Same tag name used by both users must not merge into one shared tag.
    expect(listA.body.tags).toHaveLength(1);
    expect(listA.body.tags[0].contentId).toHaveLength(1);
    expect(listA.body.tags[0].contentId[0]).toBe(listA.body.contents[0]._id);
  });

  it("deletes content owned by the requesting user", async () => {
    const token = await signupAndSignin("contentuser2");

    const createRes = await request(app)
      .post("/api/v1/content")
      .set("Authorization", token)
      .field("title", "To Delete")
      .field("contentType", "article")
      .field("link", "https://example.com/delete-me")
      .field("tags", "temp");

    const contentId = createRes.body.data._id;

    const deleteRes = await request(app)
      .delete(`/api/v1/content/${contentId}`)
      .set("Authorization", token);

    expect(deleteRes.status).toBe(200);

    const listRes = await request(app)
      .get("/api/v1/content")
      .set("Authorization", token);

    expect(listRes.body.contents).toHaveLength(0);
  });

  it("rejects deleting another user's content", async () => {
    const tokenA = await signupAndSignin("contentuserC");
    const tokenB = await signupAndSignin("contentuserD");

    const createRes = await request(app)
      .post("/api/v1/content")
      .set("Authorization", tokenA)
      .field("title", "A's Content")
      .field("contentType", "article")
      .field("link", "https://example.com/protected")
      .field("tags", "x");

    const contentId = createRes.body.data._id;

    const deleteRes = await request(app)
      .delete(`/api/v1/content/${contentId}`)
      .set("Authorization", tokenB);

    expect(deleteRes.status).toBe(404);
  });

  it("only exposes safe fields on the public share endpoints", async () => {
    const token = await signupAndSignin("contentuser3");

    const createRes = await request(app)
      .post("/api/v1/content")
      .set("Authorization", token)
      .field("title", "Shared Content")
      .field("contentType", "article")
      .field("link", "https://example.com/shared")
      .field("tags", "x");

    const contentId = createRes.body.data._id;

    const shareRes = await request(app)
      .post(`/api/v1/content/${contentId}/share`)
      .set("Authorization", token);

    expect(shareRes.status).toBe(200);
    const hash = shareRes.body.hash;
    expect(hash).toBeTruthy();

    const publicRes = await request(app).get(`/api/v1/content/share/${hash}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.content.title).toBe("Shared Content");
    expect(publicRes.body.content.transcription).toBeUndefined();
    expect(publicRes.body.content.vectorDB).toBeUndefined();
    expect(publicRes.body.content.aiChat).toBeUndefined();
    expect(publicRes.body.content.userId).toBeUndefined();
  });
});
