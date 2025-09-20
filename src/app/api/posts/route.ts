
import { NextRequest, NextResponse } from 'next/server';
import { connect } from '../../../lib/db.js';
import Post from '../../../models/post.model.js';

export async function GET() {
  try {
    await connect();
    const posts = await Post.find({});
    return NextResponse.json(posts, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { postType, text, picture, audio } = body;

    // Basic validation
    if (!postType || !['picture', 'text', 'audio'].includes(postType)) {
        return NextResponse.json({ message: 'Invalid or missing postType' }, { status: 400 });
    }

    // Validate fields based on postType
    if (postType === 'text') {
        if (!text || typeof text.content !== 'string') {
            return NextResponse.json({ message: 'Text post must have content' }, { status: 400 });
        }
        // Optionally validate metadata structure
        if (text.metadata) {
            if (text.metadata.sentiment && typeof text.metadata.sentiment !== 'string') {
                return NextResponse.json({ message: 'Invalid sentiment type' }, { status: 400 });
            }
            if (text.metadata.topics && !Array.isArray(text.metadata.topics)) {
                return NextResponse.json({ message: 'Topics must be an array of strings' }, { status: 400 });
            }
        }
    } else if (postType === 'picture') {
        if (!picture || typeof picture.url !== 'string') {
            return NextResponse.json({ message: 'Picture post must have url' }, { status: 400 });
        }
        if (picture.metadata) {
            if (picture.metadata.objects && !Array.isArray(picture.metadata.objects)) {
                return NextResponse.json({ message: 'Objects must be an array of strings' }, { status: 400 });
            }
            if (picture.metadata.scene && typeof picture.metadata.scene !== 'string') {
                return NextResponse.json({ message: 'Scene must be a string' }, { status: 400 });
            }
            if (picture.metadata.colors && !Array.isArray(picture.metadata.colors)) {
                return NextResponse.json({ message: 'Colors must be an array of strings' }, { status: 400 });
            }
        }
    } else if (postType === 'audio') {
        if (!audio || typeof audio.url !== 'string') {
            return NextResponse.json({ message: 'Audio post must have url' }, { status: 400 });
        }
        if (audio.metadata) {
            if (audio.metadata.tone && typeof audio.metadata.tone !== 'string') {
                return NextResponse.json({ message: 'Tone must be a string' }, { status: 400 });
            }
            if (audio.metadata.keywords && !Array.isArray(audio.metadata.keywords)) {
                return NextResponse.json({ message: 'Keywords must be an array of strings' }, { status: 400 });
            }
        }
    }

    try {
        await connect();
        const newPost = new Post(body);
        await newPost.save();
        return NextResponse.json(newPost, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
// Example usage in POST, PUT, DELETE (if needed)
export async function DELETE(req: NextRequest) {
    const body = await req.json();
    const { _id } = body;

    if (!_id) {
        return NextResponse.json({ message: 'Post ID is required' }, { status: 400 });
    }

    try {
        await connect();
        const deletedPost = await Post.findByIdAndDelete(_id);
        if (!deletedPost) {
            return NextResponse.json({ message: 'Post not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Post deleted successfully' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to delete post' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { _id, ...updateData } = body;

  if (!_id) {
    return NextResponse.json({ message: 'Post ID is required' }, { status: 400 });
  }

  try {
    await connect();
    const updatedPost = await Post.findByIdAndUpdate(_id, updateData, { new: true });
    if (!updatedPost) {
      return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json(updatedPost, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to update post' }, { status: 500 });
  }
}