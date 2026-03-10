import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@ccs/supabase';
import { useRouter } from 'expo-router';
import { TEST_SITUACIONAL, calcularResultadoTest, determinarRolesPrincipales } from '@ccs/logic';
import { ROLES, type RolKey } from '@ccs/ui';
import { Ionicons } from '@expo/vector-icons';
import RadarChart from '../components/RadarChart';

type Fase = 'intro' | 'pregunta' | 'resultado' | 'seleccion';

export default function TestScreen() {
    const router = useRouter();
    const [fase, setFase] = useState<Fase>('intro');
    const [pregActual, setPregActual] = useState(0);
    const [respuestas, setRespuestas] = useState<Record<string, string>>({});
    const [opcionSel, setOpcionSel] = useState<string | null>(null);
    const [resultado, setResultado] = useState<{ primario: RolKey; secundario: RolKey; scores: Record<RolKey, number> } | null>(null);
    const [prefSel, setPrefSel] = useState<'primario' | 'secundario'>('primario');
    const [guardando, setGuardando] = useState(false);

    const totalPreguntas = TEST_SITUACIONAL.length;
    const pregunta = TEST_SITUACIONAL[pregActual];

    const handleSiguiente = () => {
        if (!opcionSel) return;
        const nuevasResp = { ...respuestas, [pregunta.id]: opcionSel };
        setRespuestas(nuevasResp);
        setOpcionSel(null);

        if (pregActual + 1 < totalPreguntas) {
            setPregActual(p => p + 1);
        } else {
            const scores = calcularResultadoTest(nuevasResp, TEST_SITUACIONAL) as Record<RolKey, number>;
            const { primario, secundario } = determinarRolesPrincipales(scores);
            setResultado({ primario, secundario, scores });
            setFase('resultado');
        }
    };

    const guardarPerfil = async () => {
        if (!resultado || guardando) return;
        setGuardando(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase.from('usuarios').update({
                resultados_test: resultado.scores,
                rol_primario: resultado.primario,
                rol_secundario: resultado.secundario,
                preferencia_rol_busqueda: prefSel,
                buscando_equipo: true
            } as any).eq('id', user.id);

            if (error) {
                Alert.alert("Error", "No se pudo guardar el perfil.");
                setGuardando(false);
            } else {
                router.replace('/');
            }
        }
    };

    if (fase === 'intro') return (
        <View style={styles.container}>
            <View style={styles.introCard}>
                <Text style={styles.introIcon}>🧪</Text>
                <Text style={styles.title}>Test Situacional CCS</Text>
                <Text style={styles.desc}>Descubrí tu perfil profesional respondiendo a 4 situaciones reales del ámbito sanitario.</Text>
                <View style={styles.tips}>
                    <Text style={styles.tip}>• Elegí con honestidad natural.</Text>
                    <Text style={styles.tip}>• No hay respuestas incorrectas.</Text>
                    <Text style={styles.tip}>• Solo toma 2 minutos.</Text>
                </View>
                <TouchableOpacity style={styles.btnMain} onPress={() => setFase('pregunta')}>
                    <Text style={styles.btnText}>Empezar Test</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (fase === 'resultado' && resultado) {
        return (
            <ScrollView style={styles.container}>
                <View style={styles.resultCard}>
                    <Text style={styles.title}>Tu Perfil CCS</Text>
                    <View style={styles.rolesRow}>
                        <View style={[styles.rolBox, { borderColor: ROLES[resultado.primario].color }]}>
                            <Text style={styles.rolEmoji}>{ROLES[resultado.primario].icon}</Text>
                            <Text style={styles.rolName}>{ROLES[resultado.primario].label}</Text>
                            <Text style={styles.rolSub}>Primario</Text>
                        </View>
                        <View style={[styles.rolBox, { borderColor: ROLES[resultado.secundario].color }]}>
                            <Text style={styles.rolEmoji}>{ROLES[resultado.secundario].icon}</Text>
                            <Text style={styles.rolName}>{ROLES[resultado.secundario].label}</Text>
                            <Text style={styles.rolSub}>Secundario</Text>
                        </View>
                    </View>
                    <View style={styles.chartPad}>
                        <RadarChart scores={resultado.scores} size={250} />
                    </View>
                    <TouchableOpacity style={styles.btnMain} onPress={() => setFase('seleccion')}>
                        <Text style={styles.btnText}>Continuar</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    if (fase === 'seleccion' && resultado) {
        const rP = ROLES[resultado.primario];
        const rS = ROLES[resultado.secundario];
        return (
            <View style={styles.container}>
                <View style={styles.introCard}>
                    <Text style={styles.title}>Perfil de Búsqueda</Text>
                    <Text style={styles.desc}>¿Cómo preferís que te vean otros compañeros al buscar un equipo?</Text>

                    <TouchableOpacity
                        style={[styles.selBtn, prefSel === 'primario' && { borderColor: rP.color, backgroundColor: rP.color + '10' }]}
                        onPress={() => setPrefSel('primario')}
                    >
                        <Text style={styles.rolEmoji}>{rP.icon}</Text>
                        <Text style={styles.selText}>{rP.label} (Primario)</Text>
                        {prefSel === 'primario' && <Ionicons name="checkmark-circle" size={24} color={rP.color} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.selBtn, prefSel === 'secundario' && { borderColor: rS.color, backgroundColor: rS.color + '10' }]}
                        onPress={() => setPrefSel('secundario')}
                    >
                        <Text style={styles.rolEmoji}>{rS.icon}</Text>
                        <Text style={styles.selText}>{rS.label} (Secundario)</Text>
                        {prefSel === 'secundario' && <Ionicons name="checkmark-circle" size={24} color={rS.color} />}
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.btnMain, { marginTop: 30 }]} onPress={guardarPerfil} disabled={guardando}>
                        {guardando ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Guardar y Finalizar</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.progress}>
                <Text style={styles.progressText}>Pregunta {pregActual + 1} de {totalPreguntas}</Text>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${((pregActual + 1) / totalPreguntas) * 100}%` }]} />
                </View>
            </View>
            <ScrollView contentContainerStyle={styles.centered}>
                <Text style={styles.pregunta}>{pregunta.texto}</Text>
                {pregunta.opciones.map(op => (
                    <TouchableOpacity
                        key={op.id}
                        style={[styles.opcion, opcionSel === op.id && styles.opcionSel]}
                        onPress={() => setOpcionSel(op.id)}
                    >
                        <Text style={[styles.opcionTexto, opcionSel === op.id && styles.opcionTextoSel]}>{op.texto}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
                style={[styles.btnMain, { margin: 20 }, !opcionSel && { opacity: 0.5 }]}
                onPress={handleSiguiente}
                disabled={!opcionSel}
            >
                <Text style={styles.btnText}>{pregActual + 1 < totalPreguntas ? 'Siguiente' : 'Ver Resultados'}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    centered: { padding: 30, alignItems: 'center' },
    introCard: { flex: 1, justifyContent: 'center', padding: 30, alignItems: 'center' },
    introIcon: { fontSize: 60, marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1a2b5e', textAlign: 'center', marginBottom: 10 },
    desc: { textAlign: 'center', color: '#64748b', fontSize: 16, marginBottom: 20 },
    tips: { alignSelf: 'stretch', backgroundColor: 'white', padding: 20, borderRadius: 16, marginBottom: 30 },
    tip: { color: '#334155', marginVertical: 4, fontSize: 14 },
    btnMain: { backgroundColor: '#1a2b5e', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16, alignSelf: 'stretch', alignItems: 'center' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    progress: { padding: 20, paddingTop: 60 },
    progressText: { fontSize: 12, color: '#94a3b8', marginBottom: 8, textAlign: 'center' },
    progressBar: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#1a2b5e' },
    pregunta: { fontSize: 20, fontWeight: '700', color: '#1a2b5e', textAlign: 'center', marginBottom: 30 },
    opcion: { backgroundColor: 'white', padding: 20, borderRadius: 16, width: '100%', marginBottom: 12, borderWidth: 2, borderColor: '#e2e8f0' },
    opcionSel: { borderColor: '#1a2b5e', backgroundColor: '#f1f5f9' },
    opcionTexto: { fontSize: 15, color: '#334155' },
    opcionTextoSel: { fontWeight: '700', color: '#1a2b5e' },
    resultCard: { padding: 30, paddingTop: 80, alignItems: 'center' },
    rolesRow: { flexDirection: 'row', gap: 15, marginVertical: 20 },
    rolBox: { flex: 1, padding: 15, borderRadius: 16, backgroundColor: 'white', borderWidth: 2, alignItems: 'center' },
    rolEmoji: { fontSize: 32, marginBottom: 5 },
    rolName: { fontWeight: 'bold', color: '#1a2b5e', fontSize: 14 },
    rolSub: { fontSize: 10, color: '#64748b', textTransform: 'uppercase' },
    chartPad: { marginVertical: 20 },
    selBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 20, borderRadius: 16, width: '100%', marginBottom: 12, borderWidth: 2, borderColor: '#e2e8f0', gap: 15 },
    selText: { flex: 1, fontWeight: '700', color: '#1a2b5e', fontSize: 16 }
});
