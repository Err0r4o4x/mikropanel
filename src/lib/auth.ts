import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export async function getUserFromCookie() {
  const token = (await cookies()).get("auth")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { username: string; role: string };
  } catch {
    return null;
  }
}
