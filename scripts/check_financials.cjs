const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://xgdmyjzyejjmwdqkufhp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking monthly aggregates...");

    const now = new Date();
    // In our metadata, current local time is: 2026-07-04T13:14:58-04:00.
    // So now is July 2026. Let's see the months we generate.
    const months = [];
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);
    const dateOnly = twelveMonthsAgo.toISOString().split('T')[0];

    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push({
            key: monthKey,
            sales: 0,
            expenses: 0
        });
    }

    console.log("Months list:", months.map(m => m.key));

    const { data: ventas, error: venError } = await supabase
        .from("ventas")
        .select("mnt_neto, fch_emis, anulada")
        .eq("anulada", false)
        .gte("fch_emis", dateOnly);

    if (venError) {
        console.error(venError);
        return;
    }

    ventas?.forEach((v) => {
        if (!v.fch_emis) return;
        const date = new Date(v.fch_emis);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const month = months.find(m => m.key === key);
        if (month) {
            month.sales += v.mnt_neto || 0;
        } else {
            // Log if outside range
            // console.log("Outside range sales:", key, v.mnt_neto);
        }
    });

    const { data: compras, error: comError } = await supabase
        .from("compras")
        .select("monto_total, fecha_emision")
        .not("fecha_emision", "is", null)
        .gte("fecha_emision", dateOnly);

    if (comError) {
        console.error(comError);
        return;
    }

    compras?.forEach((c) => {
        if (!c.fecha_emision) return;
        const date = new Date(c.fecha_emision);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const month = months.find(m => m.key === key);
        if (month) {
            month.expenses += c.monto_total || 0;
        }
    });

    console.log("\nMonthly sales and expenses:");
    months.forEach(m => {
        console.log(`${m.key}: Sales = $${m.sales.toLocaleString('es-CL')}, Expenses = $${m.expenses.toLocaleString('es-CL')}`);
    });
}

run();
