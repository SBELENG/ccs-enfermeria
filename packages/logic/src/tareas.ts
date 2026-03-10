// @ccs/logic – Tareas orientativas predefinidas por rol
// Estas son el "termómetro" del trabajo en equipo

import { RolKey } from '@ccs/ui';

export type EstadoTarea = 'pendiente' | 'en-progreso' | 'completado';

export interface TareaOrientativa {
    id: string;
    rol: RolKey;
    descripcion: string;
    estado: EstadoTarea;
}

/** Catálogo de tareas orientativas por rol */
export const TAREAS_POR_ROL: Record<RolKey, Omit<TareaOrientativa, 'estado'>[]> = {
    organizador: [
        { id: 'org-0', rol: 'organizador', descripcion: 'Iniciar equipo asignando nombre formal al grupo' },
        { id: 'org-1', rol: 'organizador', descripcion: 'Organizar el cronograma general del trabajo (etapas, tiempos y entregas)' },
        { id: 'org-2', rol: 'organizador', descripcion: 'Distribuir tareas generales entre los integrantes del grupo' },
        { id: 'org-3', rol: 'organizador', descripcion: 'Centralizar y ordenar la información y los materiales de trabajo' },
        { id: 'org-4', rol: 'organizador', descripcion: 'Verificar el cumplimiento de consignas formales (plazos, formato, requisitos)' },
        { id: 'org-5', rol: 'organizador', descripcion: 'Coordinar la integración de los aportes individuales' },
        { id: 'org-6', rol: 'organizador', descripcion: 'Gestionar la entrega final del trabajo' },
    ],
    analitico: [
        { id: 'ana-1', rol: 'analitico', descripcion: 'Revisar la información recolectada por el grupo' },
        { id: 'ana-2', rol: 'analitico', descripcion: 'Detectar inconsistencias, vacíos o aspectos a profundizar' },
        { id: 'ana-3', rol: 'analitico', descripcion: 'Proponer criterios de análisis aplicables al trabajo' },
        { id: 'ana-4', rol: 'analitico', descripcion: 'Comparar información de distintas fuentes' },
        { id: 'ana-5', rol: 'analitico', descripcion: 'Elaborar conclusiones parciales o finales' },
        { id: 'ana-6', rol: 'analitico', descripcion: 'Sugerir mejoras basadas en el análisis del proceso y del resultado' },
    ],
    ejecutor: [
        { id: 'eje-1', rol: 'ejecutor', descripcion: 'Participar activamente en la elaboración del producto final' },
        { id: 'eje-2', rol: 'ejecutor', descripcion: 'Ejecutar tareas prácticas acordadas por el grupo' },
        { id: 'eje-3', rol: 'ejecutor', descripcion: 'Colaborar en la implementación de actividades planificadas' },
        { id: 'eje-4', rol: 'ejecutor', descripcion: 'Resolver aspectos operativos del trabajo' },
        { id: 'eje-5', rol: 'ejecutor', descripcion: 'Verificar que lo producido sea funcional y claro' },
        { id: 'eje-6', rol: 'ejecutor', descripcion: 'Apoyar a otros roles en momentos de alta carga de trabajo' },
    ],
    creativo: [
        { id: 'cre-1', rol: 'creativo', descripcion: 'Proponer enfoques originales para abordar la consigna' },
        { id: 'cre-2', rol: 'creativo', descripcion: 'Sugerir formatos creativos de presentación del trabajo' },
        { id: 'cre-3', rol: 'creativo', descripcion: 'Aportar recursos visuales, gráficos o tecnológicos' },
        { id: 'cre-4', rol: 'creativo', descripcion: 'Mejorar la claridad y comprensión del contenido' },
        { id: 'cre-5', rol: 'creativo', descripcion: 'Adaptar el mensaje al público destinatario' },
        { id: 'cre-6', rol: 'creativo', descripcion: 'Enriquecer el trabajo con ejemplos o dinámicas innovadoras' },
    ],
    conciliador: [
        { id: 'con-1', rol: 'conciliador', descripcion: 'Facilitar el diálogo ante diferencias de opinión' },
        { id: 'con-2', rol: 'conciliador', descripcion: 'Ayudar al grupo a llegar a acuerdos' },
        { id: 'con-3', rol: 'conciliador', descripcion: 'Detectar tensiones o dificultades en la dinámica grupal' },
        { id: 'con-4', rol: 'conciliador', descripcion: 'Proponer alternativas frente a conflictos organizativos' },
        { id: 'con-5', rol: 'conciliador', descripcion: 'Ayudar a realizar tareas a los compañeros que lo necesiten' },
        { id: 'con-6', rol: 'conciliador', descripcion: 'Garantizar la participación equitativa de los integrantes' },
        { id: 'con-7', rol: 'conciliador', descripcion: 'Ser participante en exposiciones orales' },
        { id: 'con-8', rol: 'conciliador', descripcion: 'Colaborar en la integración de aportes individuales al trabajo final' },
        { id: 'con-9', rol: 'conciliador', descripcion: 'Asegurar que todos los miembros tengan acceso a las herramientas compartidas' },
        { id: 'con-10', rol: 'conciliador', descripcion: 'Realizar un seguimiento del bienestar del equipo durante el proceso' },
    ],
    motivador: [
        { id: 'mot-1', rol: 'motivador', descripcion: 'Estimular la participación activa del grupo' },
        { id: 'mot-2', rol: 'motivador', descripcion: 'Reforzar el valor del trabajo y su propósito formativo' },
        { id: 'mot-3', rol: 'motivador', descripcion: 'Reconocer los aportes de los compañeros' },
        { id: 'mot-4', rol: 'motivador', descripcion: 'Acompañar al grupo en momentos de cansancio o dificultad' },
        { id: 'mot-5', rol: 'motivador', descripcion: 'Favorecer un clima de trabajo positivo' },
        { id: 'mot-6', rol: 'motivador', descripcion: 'Impulsar instancias de revisión y mejora continua' },
        { id: 'mot-7', rol: 'motivador', descripcion: 'Ser participante en exposiciones orales' },
        { id: 'mot-8', rol: 'motivador', descripcion: 'Colaborar en la integración de aportes individuales al trabajo final' },
    ],
};

/** Devuelve las tareas de un rol con estado 'pendiente' por defecto */
export function getTareasIniciales(rol: RolKey): TareaOrientativa[] {
    return TAREAS_POR_ROL[rol].map(t => ({ ...t, estado: 'pendiente' as EstadoTarea }));
}

/** Calcula el porcentaje de completitud de una lista de tareas */
export function calcularCompletitud(tareas: TareaOrientativa[]): number {
    if (tareas.length === 0) return 0;
    const completadas = tareas.filter(t => t.estado === 'completado').length;
    return Math.round((completadas / tareas.length) * 100);
}
