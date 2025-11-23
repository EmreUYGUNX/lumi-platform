import { z } from "zod";

import { NextResponse } from "next/server";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = emailSchema.parse(body?.email);

    // Placeholder subscription call; replace with ESP integration.
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 150);
    });

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geçersiz istek";
    return NextResponse.json({ message }, { status: 400 });
  }
}
