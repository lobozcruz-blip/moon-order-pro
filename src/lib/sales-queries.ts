import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrderStatus, PaymentStatus, DeliveryType, Category } from "./cm";

export type PeriodKey =
  | "hoy"
  | "ayer"
  | "esta_semana"
  | "semana_pasada"
  | "este_mes"
  | "mes_pasado"
  | "personalizado";

export type DateRange = {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string;
};

/**
 * Obtiene la fecha actual en la zona horaria de México (America/Mexico_City).
 */
export function getMexicoDate(date: Date = new Date()): { year: number; month: number; day: number; dateStr: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10);
  const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { year, month, day, dateStr };
}

/**
 * Convierte un timestamp ISO a fecha YYYY-MM-DD en zona horaria de México.
 */
export function toMexicoDateStr(isoString: string | null | undefined): string {
  if (!isoString) return "";
  // Si ya viene como YYYY-MM-DD (longitud 10), devolverla directo
  if (isoString.length === 10 && isoString.includes("-")) return isoString;

  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return getMexicoDate(d).dateStr;
}

/**
 * Genera el rango de fechas para un periodo específico según el calendario de México.
 */
export function getPeriodRange(period: PeriodKey, custom?: { start?: string; end?: string }): { current: DateRange; previous: DateRange } {
  const now = new Date();
  const mx = getMexicoDate(now);

  // Crear objeto Date en horario local con la fecha de México
  const currentMxDate = new Date(mx.year, mx.month - 1, mx.day, 12, 0, 0);

  let curStart = mx.dateStr;
  let curEnd = mx.dateStr;
  let prevStart = mx.dateStr;
  let prevEnd = mx.dateStr;
  let label = "Hoy";

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  if (period === "hoy") {
    label = "Hoy";
    curStart = mx.dateStr;
    curEnd = mx.dateStr;
    const yest = new Date(currentMxDate);
    yest.setDate(yest.getDate() - 1);
    prevStart = fmt(yest);
    prevEnd = fmt(yest);
  } else if (period === "ayer") {
    label = "Ayer";
    const yest = new Date(currentMxDate);
    yest.setDate(yest.getDate() - 1);
    curStart = fmt(yest);
    curEnd = fmt(yest);
    const dayBefore = new Date(currentMxDate);
    dayBefore.setDate(dayBefore.getDate() - 2);
    prevStart = fmt(dayBefore);
    prevEnd = fmt(dayBefore);
  } else if (period === "esta_semana") {
    label = "Esta semana";
    // Semana de lunes a domingo
    const dayOfWeek = currentMxDate.getDay(); // 0 es domingo, 1 es lunes...
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(currentMxDate);
    monday.setDate(monday.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    curStart = fmt(monday);
    curEnd = fmt(sunday);

    // Semana pasada
    const prevMonday = new Date(monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevSunday = new Date(sunday);
    prevSunday.setDate(prevSunday.getDate() - 7);

    prevStart = fmt(prevMonday);
    prevEnd = fmt(prevSunday);
  } else if (period === "semana_pasada") {
    label = "Semana pasada";
    const dayOfWeek = currentMxDate.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const prevMonday = new Date(currentMxDate);
    prevMonday.setDate(prevMonday.getDate() - diffToMonday - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevSunday.getDate() + 6);

    curStart = fmt(prevMonday);
    curEnd = fmt(prevSunday);

    const prevPrevMonday = new Date(prevMonday);
    prevPrevMonday.setDate(prevPrevMonday.getDate() - 7);
    const prevPrevSunday = new Date(prevSunday);
    prevPrevSunday.setDate(prevPrevSunday.getDate() - 7);

    prevStart = fmt(prevPrevMonday);
    prevEnd = fmt(prevPrevSunday);
  } else if (period === "este_mes") {
    label = "Este mes";
    const firstDay = new Date(mx.year, mx.month - 1, 1);
    const lastDay = new Date(mx.year, mx.month, 0);

    curStart = fmt(firstDay);
    curEnd = fmt(lastDay);

    // Mes pasado
    const prevFirstDay = new Date(mx.year, mx.month - 2, 1);
    const prevLastDay = new Date(mx.year, mx.month - 1, 0);

    prevStart = fmt(prevFirstDay);
    prevEnd = fmt(prevLastDay);
  } else if (period === "mes_pasado") {
    label = "Mes pasado";
    const firstDay = new Date(mx.year, mx.month - 2, 1);
    const lastDay = new Date(mx.year, mx.month - 1, 0);

    curStart = fmt(firstDay);
    curEnd = fmt(lastDay);

    const prevFirstDay = new Date(mx.year, mx.month - 3, 1);
    const prevLastDay = new Date(mx.year, mx.month - 2, 0);

    prevStart = fmt(prevFirstDay);
    prevEnd = fmt(prevLastDay);
  } else if (period === "personalizado") {
    label = "Personalizado";
    curStart = custom?.start || mx.dateStr;
    curEnd = custom?.end || mx.dateStr;

    // Periodo anterior equivalente de misma duración en días
    const dStart = new Date(curStart + "T12:00:00");
    const dEnd = new Date(curEnd + "T12:00:00");
    const durationDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const pEnd = new Date(dStart);
    pEnd.setDate(pEnd.getDate() - 1);
    const pStart = new Date(pEnd);
    pStart.setDate(pStart.getDate() - durationDays + 1);

    prevStart = fmt(pStart);
    prevEnd = fmt(pEnd);
  }

  return {
    current: { start: curStart, end: curEnd, label },
    previous: { start: prevStart, end: prevEnd, label: `Periodo anterior` },
  };
}

export type SalesFilters = {
  assigneeId?: string;
  deliveryType?: DeliveryType | "TODOS";
  orderStatus?: OrderStatus | "TODOS";
  paymentMethod?: string | "TODOS";
  category?: Category | "TODAS";
};

export type FinancialOrder = {
  id: string;
  folio: string;
  created_at: string;
  created_date_mx: string;
  customer_name: string;
  customer_phone?: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  delivery_type?: DeliveryType | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  total: number;
  paid_amount: number;
  balance: number;
  items_count: number;
  category_subtotal?: number | undefined;
};

export type FinancialPayment = {
  id: string;
  order_id: string;
  order_folio: string;
  customer_name: string;
  amount: number;
  paid_at: string; // YYYY-MM-DD
  created_at: string;
  method: string;
  reference?: string | null;
  notes?: string | null;
  created_by_name?: string | null;
};

export type PaymentMethodSummary = {
  method: string;
  amount: number;
  count: number;
  percentage: number;
};

export type ChartDataPoint = {
  date: string;       // YYYY-MM-DD o formato agrupado
  label: string;      // ej. "12 Ago" o "Lun 12"
  ventas: number;     // Total vendido
  cobros: number;     // Total cobrado
  pedidosCount: number;
  pagosCount: number;
};

export type FinancialStats = {
  periodLabel: string;
  startDate: string;
  endDate: string;
  
  // Métricas del periodo actual
  totalVendido: number;
  totalCobrado: number;
  diferencia: number;
  pedidosCount: number;
  pagosCount: number;

  // Comparativa vs periodo previo
  prevVendido: number;
  prevCobrado: number;
  pctVentasDiff: number | null; // ej. +15.5 o -8.2
  pctCobrosDiff: number | null;

  // Saldo pendiente total histórico activo
  saldoPendienteTotal: number;
  pedidosConSaldoCount: number;

  // Desgloses
  metodosPago: PaymentMethodSummary[];
  chartData: ChartDataPoint[];
  orders: FinancialOrder[];
  payments: FinancialPayment[];
};

/**
 * Normaliza nombres de métodos de pago
 */
export function normalizePaymentMethod(method: string | null | undefined): string {
  if (!method) return "Otro";
  const m = method.trim().toLowerCase();
  if (m.includes("transf")) return "Transferencia";
  if (m.includes("efect") || m.includes("cash")) return "Efectivo";
  if (m.includes("tarj") || m.includes("card")) return "Tarjeta";
  if (m.includes("dep")) return "Depósito";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

/**
 * Hook para el resumen rápido de Ventas y Cobros en el Panel General
 */
export function useDashboardSalesSummary() {
  return useQuery({
    queryKey: ["dashboard-sales-summary"],
    queryFn: async () => {
      // Obtenemos los rangos de Hoy, Semana y Mes
      const rHoy = getPeriodRange("hoy");
      const rSemana = getPeriodRange("esta_semana");
      const rMes = getPeriodRange("este_mes");

      // Buscamos órdenes válidas (no borradores, no pendientes de aprobación)
      const { data: rawOrders, error: errOrders } = await supabase
        .from("orders")
        .select(`
          id, folio, status, total, paid_amount, balance, is_draft, review_status, created_at,
          customers(first_name, last_name)
        `)
        .eq("is_draft", false)
        .neq("review_status", "pendiente");

      if (errOrders) throw errOrders;

      // Buscamos pagos con datos de la orden asociada
      const { data: rawPayments, error: errPayments } = await supabase
        .from("payments")
        .select(`
          id, order_id, amount, paid_at, method, reference, created_at,
          orders(folio, status, customers(first_name, last_name))
        `);

      if (errPayments) throw errPayments;

      const orders = rawOrders ?? [];
      const payments = rawPayments ?? [];

      // Función auxiliar para calcular ventas en rango
      const calcVendido = (start: string, end: string) => {
        return orders
          .filter((o) => {
            if (o.status === "cancelado") return false;
            const dateStr = toMexicoDateStr(o.created_at);
            return dateStr >= start && dateStr <= end;
          })
          .reduce((sum, o) => sum + Number(o.total || 0), 0);
      };

      // Función auxiliar para calcular cobros en rango
      const calcCobrado = (start: string, end: string) => {
        return payments
          .filter((p) => {
            const dateStr = toMexicoDateStr(p.paid_at || p.created_at);
            return dateStr >= start && dateStr <= end;
          })
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      };

      // Ventas
      const vendidoHoy = calcVendido(rHoy.current.start, rHoy.current.end);
      const vendidoAyer = calcVendido(rHoy.previous.start, rHoy.previous.end);
      const vendidoSemana = calcVendido(rSemana.current.start, rSemana.current.end);
      const vendidoSemanaPasada = calcVendido(rSemana.previous.start, rSemana.previous.end);
      const vendidoMes = calcVendido(rMes.current.start, rMes.current.end);
      const vendidoMesPasado = calcVendido(rMes.previous.start, rMes.previous.end);

      // Cobros
      const cobradoHoy = calcCobrado(rHoy.current.start, rHoy.current.end);
      const cobradoAyer = calcCobrado(rHoy.previous.start, rHoy.previous.end);
      const cobradoSemana = calcCobrado(rSemana.current.start, rSemana.current.end);
      const cobradoSemanaPasada = calcCobrado(rSemana.previous.start, rSemana.previous.end);
      const cobradoMes = calcCobrado(rMes.current.start, rMes.current.end);
      const cobradoMesPasado = calcCobrado(rMes.previous.start, rMes.previous.end);

      // Saldo pendiente total activo
      const saldoPendiente = orders
        .filter((o) => o.status !== "cancelado")
        .reduce((sum, o) => sum + Math.max(0, Number(o.balance ?? (o.total - (o.paid_amount || 0)))), 0);

      // Función de % cambio seguro
      const calcDiff = (curr: number, prev: number): number | null => {
        if (prev <= 0) return curr > 0 ? 100 : null;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
      };

      return {
        hoy: {
          vendido: vendidoHoy,
          cobrado: cobradoHoy,
          diffVentas: calcDiff(vendidoHoy, vendidoAyer),
          diffCobros: calcDiff(cobradoHoy, cobradoAyer),
        },
        semana: {
          vendido: vendidoSemana,
          cobrado: cobradoSemana,
          diffVentas: calcDiff(vendidoSemana, vendidoSemanaPasada),
          diffCobros: calcDiff(cobradoSemana, cobradoSemanaPasada),
        },
        mes: {
          vendido: vendidoMes,
          cobrado: cobradoMes,
          diffVentas: calcDiff(vendidoMes, vendidoMesPasado),
          diffCobros: calcDiff(cobradoMes, cobradoMesPasado),
        },
        saldoPendiente,
      };
    },
    staleTime: 15_000,
  });
}

/**
 * Hook principal para la página completa de "Ventas y Cobros" (/ventas)
 */
export function useSalesAnalytics(
  period: PeriodKey,
  customRange?: { start?: string; end?: string },
  filters?: SalesFilters,
  chartGranularity: "dia" | "semana" | "mes" = "dia",
) {
  const { current, previous } = getPeriodRange(period, customRange);

  return useQuery({
    queryKey: ["sales-analytics", current.start, current.end, previous.start, previous.end, filters, chartGranularity],
    queryFn: async (): Promise<FinancialStats> => {
      // 1. Consultar órdenes con ítems, cliente y responsable
      const { data: rawOrders, error: errOrders } = await supabase
        .from("orders")
        .select(`
          id, folio, status, payment_status, delivery_type, priority, assignee_id,
          subtotal, discount, shipping_cost, total, paid_amount, balance,
          is_draft, review_status, created_at,
          customers(id, first_name, last_name, phone),
          order_items(id, category, quantity, unit_price, subtotal)
        `)
        .eq("is_draft", false)
        .neq("review_status", "pendiente")
        .order("created_at", { ascending: false });

      if (errOrders) throw errOrders;

      // 2. Consultar pagos con datos de la orden y perfiles
      const { data: rawPayments, error: errPayments } = await supabase
        .from("payments")
        .select(`
          id, order_id, amount, paid_at, method, reference, notes, created_at, created_by,
          orders(id, folio, status, assignee_id, delivery_type, customers(first_name, last_name, phone))
        `)
        .order("created_at", { ascending: false });

      if (errPayments) throw errPayments;

      // 3. Consultar perfiles de usuarios para resolver nombres
      const { data: rawProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email");

      const profileMap = new Map<string, string>();
      (rawProfiles ?? []).forEach((p) => {
        profileMap.set(p.id, p.full_name || p.email || "Usuario");
      });

      const allOrders = rawOrders ?? [];
      const allPayments = rawPayments ?? [];

      // Filtrar órdenes válidas para el periodo actual
      const periodOrders: FinancialOrder[] = [];
      let prevPeriodVendido = 0;

      for (const o of allOrders) {
        const dateStr = toMexicoDateStr(o.created_at);
        const isCanceled = o.status === "cancelado";

        // Filtros opcionales
        if (filters?.assigneeId && filters.assigneeId !== "TODOS" && o.assignee_id !== filters.assigneeId) continue;
        if (filters?.deliveryType && filters.deliveryType !== "TODOS" && o.delivery_type !== filters.deliveryType) continue;
        if (filters?.orderStatus && filters.orderStatus !== "TODOS" && o.status !== filters.orderStatus) continue;

        // Categoría específica de ítems
        let categorySubtotal: number | undefined = undefined;
        if (filters?.category && filters.category !== "TODAS") {
          const matchingItems = (o.order_items ?? []).filter((it: any) => it.category === filters.category);
          if (matchingItems.length === 0) continue; // Descartar si el pedido no contiene productos de esta categoría
          categorySubtotal = matchingItems.reduce((acc: number, it: any) => acc + Number(it.subtotal || 0), 0);
        }

        // Periodo actual
        if (dateStr >= current.start && dateStr <= current.end) {
          const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers;
          const custName = cust ? `${cust.first_name || ""} ${cust.last_name || ""}`.trim() || "Cliente" : "Cliente";

          periodOrders.push({
            id: o.id,
            folio: o.folio ?? "—",
            created_at: o.created_at,
            created_date_mx: dateStr,
            customer_name: custName,
            customer_phone: cust?.phone ?? null,
            status: o.status as OrderStatus,
            payment_status: o.payment_status as PaymentStatus,
            delivery_type: o.delivery_type as DeliveryType,
            assignee_id: o.assignee_id,
            assignee_name: o.assignee_id ? profileMap.get(o.assignee_id) ?? null : null,
            total: categorySubtotal !== undefined ? categorySubtotal : Number(o.total || 0),
            paid_amount: Number(o.paid_amount || 0),
            balance: Number(o.balance ?? (o.total - (o.paid_amount || 0))),
            items_count: o.order_items?.length ?? 0,
            category_subtotal: categorySubtotal,
          });
        }

        // Periodo previo (para comparaciones)
        if (!isCanceled && dateStr >= previous.start && dateStr <= previous.end) {
          prevPeriodVendido += categorySubtotal !== undefined ? categorySubtotal : Number(o.total || 0);
        }
      }

      // Filtrar pagos del periodo actual y previo
      const periodPayments: FinancialPayment[] = [];
      let prevPeriodCobrado = 0;
      const methodTotals: Record<string, { amount: number; count: number }> = {};

      for (const p of allPayments) {
        const dateStr = toMexicoDateStr(p.paid_at || p.created_at);
        const ord = Array.isArray(p.orders) ? p.orders[0] : p.orders;

        // Aplicar filtros heredados del pedido o método
        if (filters?.paymentMethod && filters.paymentMethod !== "TODOS") {
          const normMethod = normalizePaymentMethod(p.method);
          if (normMethod !== filters.paymentMethod) continue;
        }
        if (filters?.assigneeId && filters.assigneeId !== "TODOS" && ord?.assignee_id !== filters.assigneeId) continue;
        if (filters?.deliveryType && filters.deliveryType !== "TODOS" && ord?.delivery_type !== filters.deliveryType) continue;

        const cust = ord?.customers ? (Array.isArray(ord.customers) ? ord.customers[0] : ord.customers) : null;
        const custName = cust ? `${cust.first_name || ""} ${cust.last_name || ""}`.trim() || "Cliente" : "Cliente";
        const normalizedMethod = normalizePaymentMethod(p.method);
        const amount = Number(p.amount || 0);

        // Periodo actual
        if (dateStr >= current.start && dateStr <= current.end) {
          periodPayments.push({
            id: p.id,
            order_id: p.order_id,
            order_folio: ord?.folio ?? "—",
            customer_name: custName,
            amount,
            paid_at: dateStr,
            created_at: p.created_at,
            method: normalizedMethod,
            reference: p.reference ?? null,
            notes: p.notes ?? null,
            created_by_name: p.created_by ? profileMap.get(p.created_by) ?? null : null,
          });

          if (!methodTotals[normalizedMethod]) {
            methodTotals[normalizedMethod] = { amount: 0, count: 0 };
          }
          methodTotals[normalizedMethod].amount += amount;
          methodTotals[normalizedMethod].count += 1;
        }

        // Periodo previo
        if (dateStr >= previous.start && dateStr <= previous.end) {
          prevPeriodCobrado += amount;
        }
      }

      // Totales del periodo actual (excluyendo órdenes canceladas de las ventas)
      const validPeriodOrders = periodOrders.filter((o) => o.status !== "cancelado");
      const totalVendido = validPeriodOrders.reduce((sum, o) => sum + o.total, 0);
      const totalCobrado = periodPayments.reduce((sum, p) => sum + p.amount, 0);
      const diferencia = totalVendido - totalCobrado;

      // Saldo pendiente total de todos los pedidos activos en sistema
      let saldoPendienteTotal = 0;
      let pedidosConSaldoCount = 0;
      allOrders.forEach((o) => {
        if (o.status !== "cancelado") {
          const bal = Math.max(0, Number(o.balance ?? (o.total - (o.paid_amount || 0))));
          if (bal > 0) {
            saldoPendienteTotal += bal;
            pedidosConSaldoCount += 1;
          }
        }
      });

      // Cálculo de métodos de pago
      const metodosPago: PaymentMethodSummary[] = Object.entries(methodTotals)
        .map(([method, data]) => ({
          method,
          amount: data.amount,
          count: data.count,
          percentage: totalCobrado > 0 ? Number(((data.amount / totalCobrado) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      // Construcción de la serie de la gráfica
      const chartMap = new Map<string, { ventas: number; cobros: number; pedidos: number; pagos: number }>();

      // Generar días del rango si es por día
      if (chartGranularity === "dia") {
        const dStart = new Date(current.start + "T12:00:00");
        const dEnd = new Date(current.end + "T12:00:00");
        for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const key = `${y}-${m}-${day}`;
          chartMap.set(key, { ventas: 0, cobros: 0, pedidos: 0, pagos: 0 });
        }
      }

      // Sumar ventas a los puntos de gráfica
      validPeriodOrders.forEach((o) => {
        const key = o.created_date_mx;
        if (!chartMap.has(key)) {
          chartMap.set(key, { ventas: 0, cobros: 0, pedidos: 0, pagos: 0 });
        }
        const pt = chartMap.get(key)!;
        pt.ventas += o.total;
        pt.pedidos += 1;
      });

      // Sumar cobros a los puntos de gráfica
      periodPayments.forEach((p) => {
        const key = p.paid_at;
        if (!chartMap.has(key)) {
          chartMap.set(key, { ventas: 0, cobros: 0, pedidos: 0, pagos: 0 });
        }
        const pt = chartMap.get(key)!;
        pt.cobros += p.amount;
        pt.pagos += 1;
      });

      // Convertir a lista ordenada para Recharts
      const sortedKeys = Array.from(chartMap.keys()).sort();
      const chartData: ChartDataPoint[] = sortedKeys.map((key) => {
        const data = chartMap.get(key)!;
        const [y, m, d] = key.split("-").map(Number);
        const dateObj = new Date(y!, m! - 1, d!, 12, 0, 0);
        const label = dateObj.toLocaleDateString("es-MX", { day: "numeric", month: "short" });

        return {
          date: key,
          label,
          ventas: data.ventas,
          cobros: data.cobros,
          pedidosCount: data.pedidos,
          pagosCount: data.pagos,
        };
      });

      // Calcular variaciones porcentuales vs periodo anterior
      const calcDiff = (curr: number, prev: number): number | null => {
        if (prev <= 0) return curr > 0 ? 100 : null;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
      };

      return {
        periodLabel: current.label,
        startDate: current.start,
        endDate: current.end,
        totalVendido,
        totalCobrado,
        diferencia,
        pedidosCount: validPeriodOrders.length,
        pagosCount: periodPayments.length,
        prevVendido: prevPeriodVendido,
        prevCobrado: prevPeriodCobrado,
        pctVentasDiff: calcDiff(totalVendido, prevPeriodVendido),
        pctCobrosDiff: calcDiff(totalCobrado, prevPeriodCobrado),
        saldoPendienteTotal,
        pedidosConSaldoCount,
        metodosPago,
        chartData,
        orders: periodOrders,
        payments: periodPayments,
      };
    },
    staleTime: 15_000,
  });
}
