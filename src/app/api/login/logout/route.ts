import { NextResponse } from "next/server";

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true });
    
    // Limpiar cookie JWT
    res.cookies.set("auth", "", { 
      httpOnly: true, 
      path: "/", 
      maxAge: 0 
    });
    
    return res;
  } catch (error) {
    console.error('Error en logout:', error);
    return NextResponse.json({ ok: true }); // Siempre devolver ok para logout
  }
}
