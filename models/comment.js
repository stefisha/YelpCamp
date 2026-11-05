"use strict";
const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  author: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    username: { type: String, required: true },
  },
});
module.exports = mongoose.model("comment", schema);
