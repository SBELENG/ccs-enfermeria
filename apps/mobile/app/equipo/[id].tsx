import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '@ccs/supabase';
import { useLocalSearchParams } from 'expo-router';
import { ROLES, type RolKey } from '@ccs/ui';
import { Ionicons } from '@expo/vector-icons';

export default function EquipoScreen() {
    const { id } = useLocalSearchParams();
    const [equipo, setEquipo] = useState<any>(null);
    const [miembros, setMiembros] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const [{ data: eq }, { data: ms }] = await Promise.all([
                supabase.from('equipos').select('*').eq('id', id).single(),
                (supabase.from('equipo_miembros') as any).select('*, usuario:usuarios(*)').eq('equipo_id', id)
            ]);

            setEquipo(eq);
            setMiembros(ms || []);
            setLoading(false);
        }
        cargar();
    }, [id]);

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a2b5e" /></View>;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="people-circle-outline" size={60} color="#1a2b5e" />
                <Text style={styles.teamName}>{equipo?.nombre_equipo}</Text>
                <Text style={styles.teamSub}>{miembros.length} Miembros</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Integrantes</Text>
                {miembros.map(m => {
                    const rol = m.rol_en_equipo ? ROLES[m.rol_en_equipo as RolKey] : null;
                    return (
                        <View key={m.id} style={styles.memberCard}>
                            <View style={[styles.avatar, { backgroundColor: rol?.color || '#cbd5e1' }]}>
                                <Text style={styles.avatarInitial}>{m.usuario?.nombre?.[0] || '?'}</Text>
                            </View>
                            <View style={styles.memberInfo}>
                                <Text style={styles.memberName}>{m.usuario?.nombre}</Text>
                                <Text style={styles.memberRol}>{rol?.label || 'Sin Rol'}</Text>
                            </View>
                            {rol && <Text style={styles.rolIcon}>{rol.icon}</Text>}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 40, alignItems: 'center', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    teamName: { fontSize: 24, fontWeight: 'bold', color: '#1a2b5e', marginTop: 15 },
    teamSub: { color: '#64748b', fontSize: 14, marginTop: 5 },
    section: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 15 },
    memberCard: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eff6ff' },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    avatarInitial: { color: 'white', fontWeight: 'bold', fontSize: 18 },
    memberInfo: { flex: 1, marginLeft: 15 },
    memberName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    memberRol: { fontSize: 12, color: '#64748b', marginTop: 2 },
    rolIcon: { fontSize: 20 }
});
