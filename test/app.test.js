"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createApp } = require("../app");
const Campground = require("../models/campground");
const Comment = require("../models/comment");
const User = require("../models/user");
const { searchFilter } = require("../routes/campgrounds");
let mongo, app;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = require("node:http").createServer(
    createApp({ sessionSecret: "test-only-secret-".repeat(4) }),
  );
  await new Promise((resolve, reject) => {
    app.once("error", reject);
    app.listen(0, "127.0.0.1", resolve);
  });
});
after(async () => {
  if (app?.listening) await new Promise((resolve) => app.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
async function token(agent) {
  const response = await agent.get("/login").expect(200);
  return response.text.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
}
async function account(username) {
  const agent = request.agent(app);
  const csrf = await token(agent);
  await agent
    .post("/register")
    .type("form")
    .send({
      _csrf: csrf,
      username,
      password: "a-long-test-password",
      isAdmin: true,
    })
    .expect(302);
  return agent;
}
const data = {
  name: "Forest retreat",
  price: "25.50",
  image: "https://example.com/camp.jpg",
  description: "A quiet place to camp.",
};

test("account, campground, API and comment authorization flows", async (t) => {
  const owner = await account("owner_test");
  const other = await account("other_test");
  const anonymous = request.agent(app);
  let id, commentId, secondId;
  await t.test(
    "registration hashes passwords and ignores supplied admin privileges",
    async () => {
      const user = await User.findOne({ username: "owner_test" }).select(
        "+hash +salt",
      );
      assert.equal(user.isAdmin, false);
      assert.ok(user.hash);
      assert.ok(user.salt);
      assert.notEqual(user.hash, "a-long-test-password");
    },
  );
  await t.test(
    "rejects missing or malformed CSRF tokens, including Unicode",
    async () => {
      await owner.post("/api").send(data).expect(403);
      await owner
        .post("/api")
        .set("X-CSRF-Token", "é".repeat(64))
        .send(data)
        .expect(403);
    },
  );
  await t.test(
    "anonymous API mutations cannot bypass website authentication",
    async () => {
      const csrf = await token(anonymous);
      for (const [method, url] of [
        ["post", "/api"],
        ["put", "/api/000000000000000000000000"],
        ["delete", "/api/000000000000000000000000"],
      ]) {
        await anonymous[method](url)
          .set("X-CSRF-Token", csrf)
          .send(data)
          .expect(401);
      }
    },
  );
  await t.test(
    "authenticated API creation assigns the logged in author",
    async () => {
      const response = await owner
        .post("/api")
        .set("X-CSRF-Token", await token(owner))
        .send({
          ...data,
          author: { username: "forged" },
          comments: ["000000000000000000000000"],
        })
        .expect(201);
      id = response.body._id;
      assert.equal(response.body.author.username, "owner_test");
      assert.deepEqual(response.body.comments, []);
      const second = await owner
        .post("/api")
        .set("X-CSRF-Token", await token(owner))
        .send({ ...data, name: "Second camp" })
        .expect(201);
      secondId = second.body._id;
    },
  );
  await t.test(
    "rejects other users updating or deleting through either route",
    async () => {
      const csrf = await token(other);
      for (const method of ["put", "delete"]) {
        await other[method](`/api/${id}`)
          .set("X-CSRF-Token", csrf)
          .send(data)
          .expect(403);
        await other[method](`/campgrounds/${id}`)
          .set("X-CSRF-Token", csrf)
          .send({ campground: data })
          .expect(403);
      }
      assert.equal((await Campground.findById(id)).name, data.name);
    },
  );
  await t.test(
    "allows owner edits while blocking mass assignment",
    async () => {
      await owner
        .put(`/api/${id}`)
        .set("X-CSRF-Token", await token(owner))
        .send({ ...data, name: "Updated camp", author: { username: "forged" } })
        .expect(200);
      const record = await Campground.findById(id);
      assert.equal(record.author.username, "owner_test");
      assert.equal(record.name, "Updated camp");
      await owner
        .post(`/campgrounds/${id}?_method=PUT`)
        .type("form")
        .send({
          _csrf: await token(owner),
          campground: { ...data, name: "Form edited camp" },
        })
        .expect(302);
      assert.equal((await Campground.findById(id)).name, "Form edited camp");
    },
  );
  await t.test(
    "validates image protocols, prices, required fields and object injection",
    async () => {
      for (const body of [
        { ...data, image: "javascript:alert(1)" },
        { ...data, price: -5 },
        { ...data, name: "" },
        { ...data, name: { $gt: "" } },
      ]) {
        await owner
          .post("/api")
          .set("X-CSRF-Token", await token(owner))
          .send(body)
          .expect(400);
      }
      await request(app)
        .get("/campgrounds/searching?search=a&search=b")
        .expect(400);
      assert.ok(searchFilter("a.*").name.test("a.*"));
      assert.ok(!searchFilter("a.*").name.test("anything"));
    },
  );
  await t.test(
    "search treats stored markup as data and the page escapes it",
    async () => {
      const name = "<img src=x onerror=alert(1)>";
      const result = await owner
        .post("/api")
        .set("X-CSRF-Token", await token(owner))
        .send({ ...data, name })
        .expect(201);
      const page = await request(app).get("/campgrounds").expect(200);
      assert.ok(page.text.includes("&lt;img src=x onerror=alert(1)&gt;"));
      assert.ok(!page.text.includes(name));
      const search = await request(app)
        .get("/campgrounds/searching")
        .query({ search: name })
        .expect(200);
      assert.equal(search.body[0]._id, result.body._id);
      assert.equal(search.body[0].name, name);
    },
  );
  await t.test(
    "adds comments with the authenticated author and shows them",
    async () => {
      await owner
        .post(`/campgrounds/${id}/comments`)
        .type("form")
        .send({
          _csrf: await token(owner),
          comment: {
            text: "Lovely campground",
            author: { username: "forged" },
          },
        })
        .expect(302);
      const comment = await Comment.findOne({ text: "Lovely campground" });
      commentId = String(comment._id);
      assert.equal(comment.author.username, "owner_test");
      await request(app)
        .get(`/campgrounds/${id}`)
        .expect(200)
        .expect(/Lovely campground/);
    },
  );
  await t.test(
    "all rendered mutation forms have a single token and valid action",
    async () => {
      const { JSDOM } = require("jsdom");
      for (const url of [
        "/register",
        "/login",
        "/campgrounds/new",
        `/campgrounds/${id}`,
        `/campgrounds/${id}/edit`,
        `/campgrounds/${id}/comments/new`,
        `/campgrounds/${id}/comments/${commentId}/edit`,
      ]) {
        const page = await owner.get(url).expect(200);
        const dom = new JSDOM(page.text);
        for (const form of dom.window.document.querySelectorAll("form")) {
          assert.equal(
            form.querySelectorAll('input[name="_csrf"]').length,
            1,
            url,
          );
          assert.ok(!/[<>\s]/.test(form.getAttribute("action")), url);
        }
        dom.window.close();
      }
    },
  );
  await t.test(
    "validates comment parent relationship and ownership",
    async () => {
      await owner
        .put(`/campgrounds/${secondId}/comments/${commentId}`)
        .set("X-CSRF-Token", await token(owner))
        .send({ comment: { text: "Wrong parent" } })
        .expect(404);
      await other
        .put(`/campgrounds/${id}/comments/${commentId}`)
        .set("X-CSRF-Token", await token(other))
        .send({ comment: { text: "Unauthorized" } })
        .expect(403);
      await owner
        .put(`/campgrounds/${id}/comments/${commentId}`)
        .set("X-CSRF-Token", await token(owner))
        .send({
          comment: { text: "Updated comment", author: { username: "forged" } },
        })
        .expect(302);
      assert.equal(
        (await Comment.findById(commentId)).author.username,
        "owner_test",
      );
    },
  );
  await t.test(
    "database provisioned admins can moderate without taking ownership",
    async () => {
      await User.updateOne({ username: "other_test" }, { isAdmin: true });
      await other
        .put(`/api/${id}`)
        .set("X-CSRF-Token", await token(other))
        .send({ ...data, name: "Moderated camp" })
        .expect(200);
      assert.equal(
        (await Campground.findById(id)).author.username,
        "owner_test",
      );
      await User.updateOne({ username: "other_test" }, { isAdmin: false });
    },
  );
  await t.test("comment deletion removes the parent reference", async () => {
    await owner
      .delete(`/campgrounds/${id}/comments/${commentId}`)
      .set("X-CSRF-Token", await token(owner))
      .expect(302);
    assert.equal(await Comment.findById(commentId), null);
    assert.equal((await Campground.findById(id)).comments.length, 0);
  });
  await t.test("campground deletion cleans up its comments", async () => {
    await owner
      .post(`/campgrounds/${id}/comments`)
      .set("X-CSRF-Token", await token(owner))
      .send({ comment: { text: "Cleanup test" } })
      .expect(302);
    const comment = await Comment.findOne({ text: "Cleanup test" });
    await owner
      .delete(`/api/${id}`)
      .set("X-CSRF-Token", await token(owner))
      .expect(204);
    assert.equal(await Comment.findById(comment._id), null);
    assert.equal(await Campground.findById(id), null);
  });
  await t.test(
    "missing records and malformed identifiers return 404 instead of crashing",
    async () => {
      await request(app).get("/campgrounds/not-an-id").expect(404);
      await request(app)
        .get("/campgrounds/000000000000000000000000")
        .expect(404);
      await request(app).get("/unknown-page").expect(404);
      await request(app)
        .post("/api")
        .set("Content-Type", "application/json")
        .send("{bad")
        .expect(400);
    },
  );
  await t.test(
    "logout requires a protected POST and invalidates login",
    async () => {
      await owner.get("/logout").expect(404);
      await owner
        .post("/logout")
        .type("form")
        .send({ _csrf: await token(owner) })
        .expect(302);
      await owner
        .post("/api")
        .set("X-CSRF-Token", await token(owner))
        .send(data)
        .expect(401);
      await owner
        .post("/login")
        .type("form")
        .send({
          _csrf: await token(owner),
          username: "owner_test",
          password: "a-long-test-password",
        })
        .expect(302)
        .expect("Location", "/campgrounds");
    },
  );
  await t.test("security headers and local assets are served", async () => {
    const response = await request(app).get("/health").expect(200);
    assert.ok(
      response.headers["content-security-policy"].includes("script-src 'self'"),
    );
    assert.equal(response.headers["x-powered-by"], undefined);
    await request(app)
      .get("/vendor/bootstrap/css/bootstrap.min.css")
      .expect(200);
    await request(app).get("/javascripts/campgrounds.js").expect(200);
  });
  await t.test("repeated login attempts are rate limited", async () => {
    const csrf = await token(anonymous);
    let status;
    for (let i = 0; i < 21; i++) {
      const response = await anonymous
        .post("/login")
        .type("form")
        .send({
          _csrf: csrf,
          username: "unknown_test",
          password: "invalid-password",
        });
      status = response.status;
      assert.ok([302, 429].includes(status));
    }
    assert.equal(status, 429);
  });
  await t.test(
    "production requires a strong secret and a persistent store",
    () => {
      assert.throws(
        () => createApp({ sessionSecret: "short" }),
        /SESSION_SECRET/,
      );
      assert.throws(
        () => createApp({ sessionSecret: "x".repeat(48), production: true }),
        /persistent/,
      );
      assert.throws(
        () =>
          createApp({
            sessionSecret:
              "replace-with-a-random-secret-at-least-32-characters-long",
            production: true,
          }),
        /SESSION_SECRET/,
      );
    },
  );
});
