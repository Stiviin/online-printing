// app/api/support/route.ts
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

  const body = await req.json();
  const subject  = (body.subject  ?? "").trim();
  const message  = (body.message  ?? "").trim();
  const orderId  = (body.orderId  ?? "").trim() || null;

  if (!subject || !message)
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });

  const ticket = await prisma.supportTicket.create({
    data: {
      userId:  session.sub,
      subject,
      message,
      status: "OPEN",
      // optionally link to order if provided (just stored in message for now unless you add orderId field to schema)
    },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
