import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push"

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL")!

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

serve(async (req) => {
    try {
        const payload = await req.json()
        const { record } = payload // El insert de 'notificaciones'

        if (!record) return new Response("No record found", { status: 400 })

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        )

        // Buscar suscripciones del usuario
        const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("subscription")
            .eq("usuario_id", record.usuario_id)

        if (!subs || subs.length === 0) {
            return new Response("No subscriptions found", { status: 200 })
        }

        const pushPayload = JSON.stringify({
            title: "Nueva Notificación CCS",
            body: record.mensaje,
            url: record.tipo === 'contacto' ? '/marketplace' : '/dashboard'
        })

        const results = await Promise.all(
            subs.map((s: any) =>
                webpush.sendNotification(s.subscription, pushPayload).catch(err => {
                    console.error("Error enviando push:", err)
                    if (err.statusCode === 410) {
                        // Suscripción expirada, borrar de la BD
                        return supabase.from("push_subscriptions").delete().eq("subscription", s.subscription)
                    }
                })
            )
        )

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" },
        })
    } catch (err) {
        return new Response(String(err), { status: 500 })
    }
})
