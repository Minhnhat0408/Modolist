import { NextResponse } from 'next/server';
import { prisma } from '@repo/database';

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const taskCount = await prisma.task.count();
    
    return NextResponse.json({
      success: true,
      message: 'Database connected successfully',
      stats: {
        users: userCount,
        tasks: taskCount,
      },
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { success: false, error: 'Database connection failed' },
      { status: 500 }
    );
  }
}
