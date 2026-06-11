// app/api/support/route.ts
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

const createSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(150).trim(),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000).trim(),
  orderId: z.string().cuid("Invalid order ID").optional().nullable(),
});

// GET /api/support — list user's tickets
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    where:   { userId: session.sub },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tickets });
}

// POST /api/support — create a new ticket
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const json = await req.json().catch(() => null);
    if (!json) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const { subject, message, orderId } = createSchema.parse(json);

    // Verify the order belongs to this user (prevents IDOR)
    if (orderId) {
      const order = await prisma.orders.findFirst({
        where: { id: orderId, userId: session.sub },
        select: { id: true },
      });
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.create({
      data: { userId: session.sub, subject, message, status: "OPEN" },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 422 });
    console.error("[support POST]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
