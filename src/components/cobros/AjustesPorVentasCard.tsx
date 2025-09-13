"use client";

import { useEffect, useMemo, useState } from "react";

/* LocalStorage keys */
const LS_MOVS = "app_movimientos";
const TOUCH_MOVS = "__touch_movs";

/* Montos */
const AJUSTE_NANO_AC = 140;
const AJUSTE_ROUTER_PAGADO = 15;

/* @MB-RESET-DAY */
const RESET_DAY = 7; // Se reinicia el día 7

function isNanoAC(name?: string) {
  return (name ?? "").trim().toLowerCase() === "nano ac";
}
function isRouterName(name?: string) {
  return (name ?? "").trim().toLowerCase() === "router";
}
function periodStartFromResetDay(now = new Date(), resetDay = RESET_DAY) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const start = new Date(
    today >= resetDay ? y : (m === 0 ? y - 1 : y),
    today >= resetDay ? m : (m === 0 ? 11 : m - 1),
    resetDay, 0, 0, 0, 0
  );
  return start;
}

export default function AjustesPorVentasCard() {
  const [, setTouch] = useState(0);

  // Escuchar "touch" desde Inventario para refrescar en vivo
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOUCH_MOVS) setTouch((x) => x + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* @MB-AJUSTES-CALC */
  const { total, detalle } = useMemo(() => {
    let movs: Array<{ tipo?: string; equipoEtiqueta?: string; fechaISO?: string; id?: string; pagado?: boolean }> = [];
    try {
      movs = JSON.parse(localStorage.getItem(LS_MOVS) || "[]");
    } catch {}

    const start = periodStartFromResetDay(new Date(), RESET_DAY);
    let nanoCount = 0;
    let routerPagadoCount = 0;

    for (const m of movs) {
      const d = new Date(m?.fechaISO ?? 0);
      if (!(d >= start)) continue;

      if (m?.tipo === "venta" && isNanoAC(m?.equipoEtiqueta)) {
        nanoCount += 1;
      } else if (m?.tipo === "asignacion" && isRouterName(m?.equipoEtiqueta) && m?.pagado === true) {
        routerPagadoCount += 1;
      }
    }

    const total = nanoCount * AJUSTE_NANO_AC + routerPagadoCount * AJUSTE_ROUTER_PAGADO;
    const detalle = {
      nanoCount,
      routerPagadoCount,
      total,
    };
    return { total, detalle };
  }, []);

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">Ajustes por ventas (mes)</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">
        {total.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}
      </div>

      <div className="text-xs text-slate-500 mt-2">
        <div>Desde el día {RESET_DAY} del periodo actual</div>
        <div className="mt-1">
          Nano AC: +$140 × <span className="font-medium text-slate-700">{detalle.nanoCount}</span> &nbsp;|&nbsp; Router pagado: +$15 × <span className="font-medium text-slate-700">{detalle.routerPagadoCount}</span>
        </div>
      </div>
    </div>
  );
}
