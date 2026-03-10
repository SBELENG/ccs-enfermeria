import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '@ccs/supabase';
import { VictoryPolarAxis, VictoryChart, VictoryTheme, VictoryArea, VictoryGroup } from 'victory-native';

export default function PerfilScreen() {
    const [historial, setHistorial] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('perfil_historial')
                .select('*, desafio:desafios(titulo)')
                .eq('usuario_id', user.id)
                .order('created_at', { ascending: false });

            setHistorial(data || []);
            setLoading(false);
        }
        cargar();
    }, []);

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a2b5e" /></View>;

    const latest = historial[0];
    const radarData = latest ? [
        { x: 'Ejecución', y: Number(latest.score_ejecucion) || 0 },
        { x: 'Iniciativa', y: Number(latest.score_iniciativa) || 0 },
        { x: 'Clima', y: Number(latest.score_clima) || 0 },
        { x: 'Comunicación', y: Number(latest.score_comunicacion) || 0 },
    ] : [];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Mis Competencias (Último Desafío)</Text>
                {radarData.length > 0 ? (
                    <View style={styles.radarBox}>
                        <VictoryChart polar theme={VictoryTheme.material} domain={{ y: [0, 5] }}>
                            <VictoryGroup style={{ data: { fill: "#3a6bc8", fillOpacity: 0.2, stroke: "#3a6bc8", strokeWidth: 2 } }}>
                                <VictoryArea data={radarData} />
                            </VictoryGroup>
                            {radarData.map((d, i) => (
                                <VictoryPolarAxis key={i} dependentAxis style={{ axis: { stroke: "none" }, grid: { stroke: "#cbd5e1", strokeDasharray: "4, 8" } }} />
                            ))}
                            <VictoryPolarAxis labelPlacement="parallel" tickValues={radarData.map(d => d.x)} />
                        </VictoryChart>
                    </View>
                ) : (
                    <Text style={styles.empty}>Completa un desafío para ver tu radar.</Text>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Historial de Insignias</Text>
                {historial.length === 0 ? (
                    <Text style={styles.empty}>Nada por aquí todavía.</Text>
                ) : (
                    historial.map(h => (
                        <View key={h.id} style={styles.historyItem}>
                            <Text style={styles.historyDesafio}>{h.desafio.titulo}</Text>
                            <View style={styles.badgeList}>
                                {h.insignias.map((ins: string) => (
                                    <View key={ins} style={styles.badge}>
                                        <Text style={styles.badgeText}>✨ {ins}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 20, elevation: 2 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a2b5e', marginBottom: 10 },
    radarBox: { alignItems: 'center', justifyContent: 'center', height: 300 },
    section: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 15 },
    empty: { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontSize: 13 },
    historyItem: { backgroundColor: 'white', padding: 18, borderRadius: 16, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#3a6bc8' },
    historyDesafio: { fontSize: 15, fontWeight: '700', color: '#475569' },
    badgeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    badge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeText: { fontSize: 11, color: '#3a6bc8', fontWeight: 'bold' }
});
