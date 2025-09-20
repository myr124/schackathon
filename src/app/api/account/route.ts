import { NextRequest, NextResponse } from 'next/server';
import {connect} from '../../../lib/db.js';
import Account from '../../../models/account.model.js';

export async function GET(req: NextRequest) {
  try {
    await connect();
    const accounts = await Account.find({});
    return NextResponse.json(accounts, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  try {
    await connect();
    const existingAccount = await Account.findOne({ email });
    if (existingAccount) {
      return NextResponse.json({ message: 'Email already in use' }, { status: 400 });
    }

    const newAccount = new Account(body);
    await newAccount.save();
    return NextResponse.json(newAccount, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ message: 'Email is required' }, { status: 400 });
  }

  try {
    await connect();
    const deletedAccount = await Account.findOneAndDelete({ email });
    if (!deletedAccount) {
      return NextResponse.json({ message: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to delete account' }, { status: 500 });
  }
} 

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { email, ...updateData } = body;

  if (!email) {
    return NextResponse.json({ message: 'Email is required' }, { status: 400 });
  }

  try {
    await connect();
    const updatedAccount = await Account.findOneAndUpdate({ email }, updateData, { new: true });
    if (!updatedAccount) {
      return NextResponse.json({ message: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json(updatedAccount, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to update account' }, { status: 500 });
  }     
}