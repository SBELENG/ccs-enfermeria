import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@ccs/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CatedraScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [catedra, setCatedra] = useState<any>(null);
    const [desafios, setDesafios] = useState<any[]>([]);
    const [miEquipo, setMiEquipo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: cat }, { data: des }, { data: eq }] = await Promise.all([
                supabase.from('catedras').select('*').eq('id', id).single(),
                supabase.from('desafios').select('*').eq('catedra_id', id).order('fecha_entrega', { ascending: true }),
                supabase.from('equipo_miembros').select('equipo:equipos(*)').eq('usuario_id', user.id).single()
            ]);

            setCatedra(cat);
            setDesafios(des || []);
            setMiEquipo(eq?.equipo);
            setLoading(false);
        }
        cargar();
    }, [id]);

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a2b5e" /></View>;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.hero}>
                <Text style={styles.catName}>{catedra?.nombre_catedra}</Text>
                <Text style={styles.catCode}>ID: {catedra?.codigo_acceso}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Desafíos</Text>
                {desafios.map(d => (
                    <View key={d.id} style={styles.desafioCard}>
                        <View style={styles.desafioTop}>
                            <Text style={styles.desafioTitle}>{d.titulo}</Text>
                            <View style={[styles.statusBadge, d.estado === 'finalizado' ? styles.finalized : styles.active]}>
                                <Text style={styles.statusText}>{d.estado === 'finalizado' ? 'Terminado' : 'En curso'}</Text>
                            </View>
                        </View>
                        <Text style={styles.desafioDate}>Entrega: {new Date(d.fecha_entrega).toLocaleDateString()}</Text>

                        {miEquipo && d.estado !== 'finalizado' && (
                            <TouchableOpacity
                                style={styles.btnKanban}
                                onPress={() => router.push(`/kanban/${miEquipo.id}`)}
                            >
                                <Ionicons name="apps" size={18} color="white" />
                                <Text style={styles.btnText}>Tablero Kanban</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>

            {miEquipo && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Mi Equipo Actual</Text>
                    <TouchableOpacity
                        style={styles.teamCard}
                        onPress={() => router.push(`/equipo/${miEquipo.id}`)}
                    >
                        <Ionicons name="people" size={24} color="#3a6bc8" />
                        <View style={styles.teamInfo}>
                            <Text style={styles.teamName}>{miEquipo.nombre_equipo}</Text>
                            <Text style={styles.teamLink}>Ver integrantes y roles</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    hero: { padding: 30, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    catName: { fontSize: 22, fontWeight: 'bold', color: '#1a2b5e' },
    catCode: { color: '#64748b', marginTop: 5, fontSize: 13 },
    section: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 15 },
    desafioCard: { backgroundColor: 'white', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2eaf2' },
    desafioTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    desafioTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1 },
    desafioDate: { fontSize: 13, color: '#64748b', marginTop: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    active: { backgroundColor: '#dcfce7' },
    finalized: { backgroundColor: '#f1f5f9' },
    statusText: { fontSize: 10, fontWeight: '700', color: '#166534' },
    btnKanban: { backgroundColor: '#3a6bc8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, marginTop: 15, gap: 8 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    teamCard: { backgroundColor: '#eff6ff', flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16 },
    teamInfo: { flex: 1, marginLeft: 15 },
    teamName: { fontSize: 16, fontWeight: '700', color: '#1a2b5e' },
    teamLink: { fontSize: 12, color: '#3a6bc8', marginTop: 2 }
});
