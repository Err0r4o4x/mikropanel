import { NextResponse } from "next/server";
import { users } from "@/lib/users";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export async function POST(req: Request) {
  const { username, password } = await req.json();

  const user = users.find(u => u.username === username);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });

  const token = await new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", token, { httpOnly: true, path: "/", sameSite: "lax" });
  return res;
}
