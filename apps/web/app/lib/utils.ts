/**
 * Sanitiza un nombre de archivo para evitar caracteres especiales, espacios y acentos.
 * Esencial para compatibilidad con Storage Buckets (ej: Supabase).
 */
export function sanitizeFileName(name: string): string {
    return name
        .normalize("NFD")                  // Descompone caracteres con acentos
        .replace(/[\u0300-\u036f]/g, "") // Elimina los acentos
        .replace(/\s+/g, "_")              // Reemplaza espacios por guiones bajos
        .replace(/[^a-z0-9._-]/gi, "")     // Elimina cualquier otro carácter que no sea alfanumérico, punto, guion o guion bajo
        .replace(/_{2,}/g, "_");           // Limpia múltiples guiones bajos seguidos
}
