import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
    const { tokens, title, body } = await req.json()

    const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: title || 'Notificación CCS',
        body: body,
        data: { withSome: 'data' },
    }))

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
    })

    const result = await res.json()

    return new Response(
        JSON.stringify(result),
        { headers: { "Content-Type": "application/json" } },
    )
})
