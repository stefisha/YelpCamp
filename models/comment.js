var moongoose = require('mongoose');

var commentSchema = moongoose.Schema({
	text: String,
	author: {
		id: {
			type: moongoose.Schema.Types.ObjectId,
			ref: 'user'
		},
		username: String
	}
});

module.exports = moongoose.model('comment', commentSchema);
