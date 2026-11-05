"use strict";
const mongoose = require("mongoose");
const { default: passportLocalMongoose } = require("passport-local-mongoose");
const schema = new mongoose.Schema({
  isAdmin: { type: Boolean, default: false },
});
schema.plugin(passportLocalMongoose);
module.exports = mongoose.model("user", schema);
