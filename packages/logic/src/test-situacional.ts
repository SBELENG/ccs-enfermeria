// @ccs/logic – Preguntas del Test Situacional (4 preguntas, 1 por pantalla)
// Cada opción suma puntos a distintos roles

import { PreguntaTest } from './scoring';

export const TEST_SITUACIONAL: PreguntaTest[] = [
    {
        id: 'p1',
        texto: '🏥 Tu grupo de práctica clínica recibe un caso complejo con información dispersa y poco tiempo. ¿Cuál es tu primera reacción?',
        opciones: [
            {
                id: 'p1-a',
                texto: 'Propongo que dividamos el caso en partes y asignemos responsabilidades claras a cada uno.',
                puntos: { organizador: 4, ejecutor: 2 },
            },
            {
                id: 'p1-b',
                texto: 'Me dedico a leer todo el material disponible buscando inconsistencias o datos que falten.',
                puntos: { analitico: 4, organizador: 1 },
            },
            {
                id: 'p1-c',
                texto: 'Empiezo a resumir la información más relevante y a redactar los puntos clave.',
                puntos: { ejecutor: 4, creativo: 1 },
            },
            {
                id: 'p1-d',
                texto: 'Propongo una forma diferente e innovadora de abordar el caso que nadie había considerado.',
                puntos: { creativo: 4, analitico: 1 },
            },
            {
                id: 'p1-e',
                texto: 'Noto que algunos compañeros están confusos y me aseguro de que todos entiendan la situación antes de seguir.',
                puntos: { conciliador: 3, motivador: 2 },
            },
            {
                id: 'p1-f',
                texto: 'Animo al grupo diciéndoles que juntos lo vamos a resolver y que todos tienen algo valioso para aportar.',
                puntos: { motivador: 4, conciliador: 2 },
            },
        ],
    },
    {
        id: 'p2',
        texto: '📋 Durante la elaboración del trabajo práctico grupal, surgen desacuerdos sobre cómo presentar el informe final. ¿Qué hacés?',
        opciones: [
            {
                id: 'p2-a',
                texto: 'Elaboro un cronograma de las tareas pendientes y propongo cómo llegar a la entrega a tiempo.',
                puntos: { organizador: 4, ejecutor: 2 },
            },
            {
                id: 'p2-b',
                texto: 'Analizo los pros y contras de cada propuesta y planteo cuál tiene mayor fundamento.',
                puntos: { analitico: 4, organizador: 1 },
            },
            {
                id: 'p2-c',
                texto: 'Digo que lo mejor es ponerse a trabajar: el tiempo corre y hay que avanzar.',
                puntos: { ejecutor: 4, motivador: 1 },
            },
            {
                id: 'p2-d',
                texto: 'Propongo un formato visual original que podría combinar lo mejor de todas las ideas.',
                puntos: { creativo: 4, conciliador: 1 },
            },
            {
                id: 'p2-e',
                texto: 'Facilito la discusión para que todos puedan expresarse y lleguen a un acuerdo sin tensiones.',
                puntos: { conciliador: 4, motivador: 2 },
            },
            {
                id: 'p2-f',
                texto: 'Recuerdo al grupo por qué este trabajo importa y los entusiasmo para que retomen el foco.',
                puntos: { motivador: 4, conciliador: 1 },
            },
        ],
    },
    {
        id: 'p3',
        texto: '🔬 Al revisar el informe final del grupo, notás que hay secciones con errores o falta de fundamentación. ¿Cómo respondés?',
        opciones: [
            {
                id: 'p3-a',
                texto: 'Hago una lista de las correcciones necesarias y distribuyo las tareas para subsanarlas antes de la entrega.',
                puntos: { organizador: 4, analitico: 2 },
            },
            {
                id: 'p3-b',
                texto: 'Revisas cada sección críticamente y señalás qué fuentes o argumentos faltan.',
                puntos: { analitico: 4, ejecutor: 1 },
            },
            {
                id: 'p3-c',
                texto: 'Directamente corregís los errores que podés y avisás a los demás lo que queda pendiente.',
                puntos: { ejecutor: 4, analitico: 1 },
            },
            {
                id: 'p3-d',
                texto: 'Sugerís reescribir algunas secciones con un enfoque más claro y llamativo para el lector.',
                puntos: { creativo: 3, ejecutor: 2 },
            },
            {
                id: 'p3-e',
                texto: 'Hablás con los responsables de cada sección de forma diplomática y acordás las mejoras con ellos.',
                puntos: { conciliador: 4, organizador: 1 },
            },
            {
                id: 'p3-f',
                texto: 'Destacás lo mucho que avanzaron y motivás al grupo para hacer esa última revisión con energía.',
                puntos: { motivador: 4, conciliador: 1 },
            },
        ],
    },
    {
        id: 'p4',
        texto: '🎤 El grupo debe preparar la exposición oral. Hay nerviosismo y poco tiempo. ¿Cuál es tu rol natural?',
        opciones: [
            {
                id: 'p4-a',
                texto: 'Organizo quién habla, cuánto tiempo tiene cada uno y qué orden seguiremos.',
                puntos: { organizador: 4, ejecutor: 1 },
            },
            {
                id: 'p4-b',
                texto: 'Reviso que el contenido sea coherente, bien fundamentado y que no falte información clave.',
                puntos: { analitico: 4, organizador: 1 },
            },
            {
                id: 'p4-c',
                texto: 'Me encargo de las diapositivas, la síntesis y de que todo esté listo para presentar.',
                puntos: { ejecutor: 4, creativo: 1 },
            },
            {
                id: 'p4-d',
                texto: 'Propongo una apertura creativa o un recurso visual que haga la presentación más impactante.',
                puntos: { creativo: 4, ejecutor: 1 },
            },
            {
                id: 'p4-e',
                texto: 'Me aseguro de que todos estén incluidos en la exposición y me ofrezco a participar donde sea necesario.',
                puntos: { conciliador: 4, motivador: 2 },
            },
            {
                id: 'p4-f',
                texto: 'Transmito confianza al grupo, repaso lo que cada uno dirá y los animo antes de salir a exponer.',
                puntos: { motivador: 4, conciliador: 2 },
            },
        ],
    },
];
