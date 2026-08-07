import request from "supertest";
import app from "../app";

describe("Auth routes", () => {
  const user = {
    name: "Test User",
    username: "testuser1",
    password: "password123",
  };

  it("signs up a new user", async () => {
    const res = await request(app).post("/api/v1/signup").send(user);
    expect(res.status).toBe(201);
  });

  it("rejects duplicate username on signup", async () => {
    await request(app).post("/api/v1/signup").send(user);
    const res = await request(app).post("/api/v1/signup").send(user);
    expect(res.status).toBe(400);
  });

  it("signs in with correct credentials", async () => {
    await request(app).post("/api/v1/signup").send(user);
    const res = await request(app)
      .post("/api/v1/signin")
      .send({ username: user.username, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("rejects sign in with wrong password", async () => {
    await request(app).post("/api/v1/signup").send(user);
    const res = await request(app)
      .post("/api/v1/signin")
      .send({ username: user.username, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
  });

  describe("change-password", () => {
    it("rejects the wrong current password", async () => {
      await request(app).post("/api/v1/signup").send(user);
      const signinRes = await request(app)
        .post("/api/v1/signin")
        .send({ username: user.username, password: user.password });
      const token = signinRes.body.token;

      const res = await request(app)
        .post("/api/v1/change-password")
        .set("Authorization", token)
        .send({ currentPassword: "wrongpassword", newPassword: "newpassword123" });

      expect(res.status).toBe(401);
    });

    it("changes the password when the current password is correct", async () => {
      await request(app).post("/api/v1/signup").send(user);
      const signinRes = await request(app)
        .post("/api/v1/signin")
        .send({ username: user.username, password: user.password });
      const token = signinRes.body.token;

      const res = await request(app)
        .post("/api/v1/change-password")
        .set("Authorization", token)
        .send({ currentPassword: user.password, newPassword: "newpassword123" });

      expect(res.status).toBe(200);

      const oldSignin = await request(app)
        .post("/api/v1/signin")
        .send({ username: user.username, password: user.password });
      expect(oldSignin.status).toBe(401);

      const newSignin = await request(app)
        .post("/api/v1/signin")
        .send({ username: user.username, password: "newpassword123" });
      expect(newSignin.status).toBe(200);
    });
  });

  describe("logout / token blacklist", () => {
    it("rejects a token after logout", async () => {
      await request(app).post("/api/v1/signup").send(user);
      const signinRes = await request(app)
        .post("/api/v1/signin")
        .send({ username: user.username, password: user.password });
      const token = signinRes.body.token;

      const meBefore = await request(app)
        .get("/api/v1/me")
        .set("Authorization", token);
      expect(meBefore.status).toBe(200);

      await request(app).post("/api/v1/logout").set("Authorization", token);

      const meAfter = await request(app)
        .get("/api/v1/me")
        .set("Authorization", token);
      expect(meAfter.status).toBe(401);
    });
  });
});
