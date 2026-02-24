// ============================================================
// @ccs/logic – Algoritmo de scoring de los 6 roles CCS
// ============================================================
import { RolKey, ROL_KEYS } from '@ccs/ui';

/** Puntuación máxima posible por rol en el test */
export const MAX_SCORE_POR_ROL = 8;

/**
 * Resultado del test situacional.
 * Cada pregunta tiene N opciones; cada opción aporta puntos
 * a uno o más roles. El resultado es un objeto con la puntuación
 * normalizada (0–100) para cada uno de los 6 roles.
 */
export type ResultadoTest = Record<RolKey, number>;

/**
 * Una opción de respuesta asigna puntos a distintos roles.
 * Ejemplo: { organizador: 3, ejecutor: 1 }
 */
export type OpcionRespuesta = Partial<Record<RolKey, number>>;

/**
 * Representa una pregunta del test situacional.
 */
export interface PreguntaTest {
    id: string;
    texto: string;
    opciones: {
        id: string;
        texto: string;
        puntos: OpcionRespuesta;
    }[];
}

/**
 * Calcula el resultado del test a partir de las respuestas elegidas.
 * @param respuestas - Map de preguntaId → opcionId seleccionada
 * @param preguntas  - Lista completa de preguntas del test
 * @returns ResultadoTest con valores normalizados 0–100
 */
export function calcularResultadoTest(
    respuestas: Record<string, string>,
    preguntas: PreguntaTest[]
): ResultadoTest {
    // Acumular puntos crudos
    const raw: Record<string, number> = Object.fromEntries(
        ROL_KEYS.map(k => [k, 0])
    );

    for (const pregunta of preguntas) {
        const opcionId = respuestas[pregunta.id];
        if (!opcionId) continue;
        const opcion = pregunta.opciones.find(o => o.id === opcionId);
        if (!opcion) continue;
        for (const [rol, pts] of Object.entries(opcion.puntos)) {
            raw[rol] = (raw[rol] ?? 0) + (pts ?? 0);
        }
    }

    // Normalizar a 0–100
    const totalPtsMax = preguntas.length * MAX_SCORE_POR_ROL;
    const normalizado = Object.fromEntries(
        ROL_KEYS.map(rol => [
            rol,
            Math.round((raw[rol] / totalPtsMax) * 100),
        ])
    ) as ResultadoTest;

    return normalizado;
}

/**
 * Determina el Rol Primario y Secundario a partir del resultado del test.
 */
export function determinarRolesPrincipales(resultado: ResultadoTest): {
    primario: RolKey;
    secundario: RolKey;
} {
    const sorted = (Object.entries(resultado) as [RolKey, number][])
        .sort(([, a], [, b]) => b - a);

    return {
        primario: sorted[0][0],
        secundario: sorted[1][0],
    };
}

/**
 * Calcula el Radar de Equilibrio de un equipo.
 * Promedia los scores de cada rol entre todos los miembros.
 */
export function calcularRadarEquipo(
    miembros: ResultadoTest[]
): ResultadoTest {
    if (miembros.length === 0) {
        return Object.fromEntries(ROL_KEYS.map(k => [k, 0])) as ResultadoTest;
    }

    const suma = Object.fromEntries(ROL_KEYS.map(k => [k, 0]));
    for (const m of miembros) {
        for (const rol of ROL_KEYS) {
            suma[rol] += m[rol];
        }
    }

    return Object.fromEntries(
        ROL_KEYS.map(rol => [rol, Math.round(suma[rol] / miembros.length)])
    ) as ResultadoTest;
}

/**
 * Detecta qué roles están subrepresentados en el equipo
 * (menos del umbral mínimo).
 */
export function rolesSubrepresentados(
    radarEquipo: ResultadoTest,
    umbral = 20
): RolKey[] {
    return ROL_KEYS.filter(rol => radarEquipo[rol] < umbral);
}
