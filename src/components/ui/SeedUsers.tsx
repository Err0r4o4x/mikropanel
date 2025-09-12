"use client";
import { useEffect } from "react";

export default function SeedUsers() {
  useEffect(() => {
    try {
      const KEY = "app_users";
      if (localStorage.getItem(KEY)) return; // ya existe: no tocar

      const USERS = [
        { id: "u-misael", username: "misael", rol: "admin" },
        { id: "u-gaby",   username: "gaby",   rol: "tech" },
        { id: "u-kenny",  username: "kenny",  rol: "tech" },     // ← añadido
        { id: "u-thalia", username: "thalia", rol: "envios" },   // ← añadido
      ];
      localStorage.setItem(KEY, JSON.stringify(USERS));
    } catch {}
  }, []);

  return null;
}
