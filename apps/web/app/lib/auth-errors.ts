/**
 * Traduce mensajes de error de Supabase (en inglés) a español.
 * Usar en todas las páginas de autenticación.
 */
export function traducirError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
        return 'Email o contraseña incorrectos.';
    if (m.includes('email not confirmed'))
        return 'Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.';
    if (m.includes('user already registered') || m.includes('already been registered'))
        return 'Ya existe una cuenta con ese email.';
    if (m.includes('password should be at least'))
        return 'La contraseña debe tener al menos 8 caracteres.';
    if (m.includes('unable to validate email address'))
        return 'El email ingresado no es válido.';
    if (m.includes('email rate limit exceeded') || m.includes('rate limit'))
        return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.';
    if (m.includes('row-level security') || m.includes('rls'))
        return 'No se pudo guardar el perfil. Contactá al administrador.';
    if (m.includes('duplicate key') || m.includes('unique constraint'))
        return 'Ya existe una cuenta con ese email.';
    if (m.includes('network') || m.includes('fetch'))
        return 'Error de conexión. Verificá tu internet e intentá de nuevo.';
    if (m.includes('otp') || m.includes('magic link'))
        return 'No se pudo enviar el link. Verificá el email e intentá de nuevo.';
    return msg;
}
