import { createClient } from "@supabase/supabase-js";
import { config } from "@/config/index.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
