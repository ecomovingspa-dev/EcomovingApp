import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, supabaseUrl } from './supabase-client.js';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabase();
    // 0. Sanitize Key (Remove quotes or spaces)
    const rawKey = process.env.BREVO_API_K
