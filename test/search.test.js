"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
test("dynamic search cards display markup as literal text", () => {
  const dom = new JSDOM(
    '<input id="search"><div id="campsList"></div><p id="search-status"></p>',
    { runScripts: "outside-only" },
  );
  dom.window.eval(
    fs.readFileSync(
      path.join(__dirname, "../public/javascripts/campgrounds.js"),
      "utf8",
    ) + "\nwindow.renderSearchCard = card;",
  );
  const record = {
    _id: "123",
    name: "<img src=x onerror=alert(1)>",
    image: 'https://example.com/" onerror="alert(1)',
  };
  const card = dom.window.renderSearchCard(record);
  assert.equal(card.querySelector("h4").textContent, record.name);
  assert.equal(card.querySelectorAll("img").length, 1);
  assert.equal(card.querySelector("img").getAttribute("onerror"), null);
  assert.equal(
    card.querySelector("a").getAttribute("href"),
    "/campgrounds/123",
  );
  dom.window.close();
});
