const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
	userId: {
		type: String,
		required: true,
		unique: true
	},
	name: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true,
		unique: true
	},
    password: {
		type: String,
		required: true
	},
	location: {
		type: {
			type: String,
			enum: ['Point'],
			required: true
		},
		coordinates: {
			type: [Number],
			required: true
		}
	},
	photos: [
		{
			url: { type: String, required: true },
			order: { type: Number, required: true }
		}
	],
	voiceProfile: {
		prompts: [
			{
				text: { type: String, required: true },
				audioUrl: { type: String, required: true }
			}
		],
		personalityProfile: { type: String }
	},
	interests: [{ type: String }],
	friends: [{ type: String }],

	createdAt: {
		type: Date,
		default: Date.now
	}
});

module.exports = mongoose.model('Account', accountSchema);