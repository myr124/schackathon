const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  postType: {
    type: String,
    enum: ['picture', 'text', 'audio'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  text: {
    content: String,
    metadata: {
      sentiment: String,
      topics: [String]
    }
  },
  picture: {
    url: String,
    caption: String,
    metadata: {
      objects: [String],
      scene: String,
      colors: [String]
    }
  },
  audio: {
    url: String,
    transcript: String,
    metadata: {
      tone: String,
      keywords: [String]
    }
  }
});

module.exports = mongoose.model('Post', postSchema);
