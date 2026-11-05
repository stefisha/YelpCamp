"use strict";
require("dotenv").config();
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { MongoStore } = require("connect-mongo");
const { createApp } = require("./app");

async function start() {
  const production = process.env.NODE_ENV === "production";
  if (production && (!process.env.DATABASEURL || !process.env.SESSION_SECRET)) {
    throw new Error("Production requires DATABASEURL and SESSION_SECRET.");
  }
  const sessionSecret =
    process.env.SESSION_SECRET || crypto.randomBytes(48).toString("hex");
  await mongoose.connect(
    process.env.DATABASEURL || "mongodb://127.0.0.1:27017/yelp_camp",
    { serverSelectionTimeoutMS: 10000 },
  );
  const store = MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: "sessions",
    ttl: 86400,
  });
  const app = createApp({
    sessionSecret,
    store,
    production,
    trustProxy: process.env.TRUST_PROXY === "1",
  });
  const server = app.listen(process.env.PORT || 3000, () =>
    console.log(`YelpCamp listening on port ${server.address().port}`),
  );
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await mongoose.disconnect();
      clearTimeout(timeout);
    });
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
start().catch(async (err) => {
  console.error("YelpCamp could not start:", err.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
