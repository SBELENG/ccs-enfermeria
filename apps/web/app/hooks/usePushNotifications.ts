'use client';
import { supabase } from '@ccs/supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function usePushNotifications() {
    async function suscribir(userId: string) {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push no soportado');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: VAPID_PUBLIC_KEY
            });

            // Guardar en Supabase
            await (supabase.from('push_subscriptions') as any).upsert({
                usuario_id: userId,
                subscription: subscription.toJSON() as any
            }, { onConflict: 'usuario_id' });

            console.log('Suscripción exitosa');
        } catch (error) {
            console.error('Error suscribiendo a push:', error);
        }
    }

    return { suscribir };
}
