"use client";
import { useEffect } from "react";

export default function SeedUsers() {
  useEffect(() => {
    // Ya no usamos localStorage - los datos vienen de Supabase
    console.log("SeedUsers: Ya no usamos localStorage");
  }, []);

  return null;
}
