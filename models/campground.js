"use strict";
const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  price: { type: String, required: true },
  image: { type: String, required: true, maxlength: 2000 },
  description: { type: String, required: true, maxlength: 5000 },
  author: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    username: { type: String, required: true },
  },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "comment" }],
});
module.exports = mongoose.model("campground", schema);
