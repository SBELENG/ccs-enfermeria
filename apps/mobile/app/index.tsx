import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@ccs/supabase';
import { useRouter } from 'expo-router';
import { ROLES, type RolKey } from '@ccs/ui';
import { getTareasIniciales } from '@ccs/logic';
import { Ionicons } from '@expo/vector-icons';
import { usePushNotifications } from '../hooks/usePushNotifications';
import RadarChart from '../components/RadarChart';

export default function MobileIndex() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [catedras, setCatedras] = useState<any[]>([]);
    const [tareas, setTareas] = useState<any[]>([]);

    // Inicializar Notificaciones Push
    usePushNotifications();

    useEffect(() => {
        async function checkUser() {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (!u) {
                router.replace('/login');
                return;
            }
            setUser(u);

            // Cargar inscripciones reales
            const { data: inscripciones } = await supabase
                .from('inscripciones')
                .select('*, catedra:catedras(*)')
                .eq('usuario_id', u.id);

            if (inscripciones) {
                setCatedras(inscripciones.map((i: any) => i.catedra).filter(Boolean));
            }

            // Cargar perfil completo
            const { data: profile } = await supabase.from('usuarios').select('*').eq('id', u.id).single();
            if (profile) {
                setUser({ ...u, ...profile });
                if (profile.rol_primario) {
                    setTareas(getTareasIniciales(profile.rol_primario as RolKey));
                }
            }

            setLoading(false);
        }
        checkUser();
    }, []);

    if (loading) return (
        <View style={styles.center}><ActivityIndicator size="large" color="#1a2b5e" /></View>
    );

    if (!user) return (
        <View style={styles.center}>
            <Text style={styles.welcome}>Bienvenido a CCS</Text>
            <Text style={styles.sub}>Inicia sesión en la web para sincronizar tu cuenta.</Text>
        </View>
    );

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.greeting}>Hola, {user.nombre || user.user_metadata?.nombre || 'Estudiante'}</Text>
                <Text style={styles.subtitle}>{user.rol_primario ? ROLES[user.rol_primario as RolKey]?.label : 'Pendiente de Perfil'}</Text>
            </View>

            {/* Banner Test Pendiente */}
            {!user.rol_primario && (
                <TouchableOpacity
                    style={styles.testBanner}
                    onPress={() => router.push('/test')}
                >
                    <View style={styles.testBannerInner}>
                        <Text style={styles.testEmoji}>🧪</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.testTitle}>Descubrí tu Talento CCS</Text>
                            <Text style={styles.testSub}>Realizá el test para unirte a equipos.</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={24} color="white" />
                    </View>
                </TouchableOpacity>
            )}

            {/* Radar View si tiene perfil */}
            {user.resultados_test && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Mi Radar de Competencias</Text>
                    <View style={styles.radarCard}>
                        <RadarChart scores={user.resultados_test} size={220} />
                    </View>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mis Cátedras</Text>
                {catedras.length === 0 ? (
                    <Text style={styles.empty}>No tienes cátedras activas.</Text>
                ) : (
                    catedras.map(c => (
                        <TouchableOpacity
                            key={c.id}
                            style={styles.card}
                            onPress={() => router.push(`/catedra/${c.id}`)}
                        >
                            <View style={styles.cardRow}>
                                <Ionicons name="school-outline" size={24} color="#1a2b5e" />
                                <View style={styles.cardBody}>
                                    <Text style={styles.cardName}>{c.nombre_materia || c.nombre_catedra}</Text>
                                    <Text style={styles.cardInfo}>Código: {c.codigo_acceso}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </View>

            {/* TAREAS DEL ROL */}
            {tareas.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tareas Sugeridas (Rol)</Text>
                    <View style={styles.tasksBox}>
                        {tareas.map((t: any) => (
                            <View key={t.id} style={styles.taskItem}>
                                <Ionicons
                                    name={t.estado === 'completado' ? "checkbox" : "square-outline"}
                                    size={20}
                                    color={t.estado === 'completado' ? "#10b981" : "#94a3b8"}
                                />
                                <Text style={[styles.taskText, t.estado === 'completado' && styles.taskDone]}>
                                    {t.descripcion}
                                </Text>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.taskTip}>* Completá estas tareas en la versión web para avanzar con tu equipo.</Text>
                </View>
            )}

            <TouchableOpacity
                style={[styles.card, styles.historyCard]}
                onPress={() => router.push('/perfil')}
            >
                <Ionicons name="ribbon-outline" size={24} color="#f59e0b" />
                <Text style={styles.historyText}>Ver mi Historial de Carrera</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.btnMas}
                onPress={() => router.push('/mas')}
            >
                <Ionicons name="ellipsis-horizontal-circle" size={24} color="#64748b" />
                <Text style={styles.btnMasText}>Contacto y Legal</Text>
            </TouchableOpacity>

            <View style={styles.footerMin}>
                <Text style={styles.footerMinText}>Desarrollado por Ideas Digitales</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    header: { padding: 30, backgroundColor: '#1a2b5e', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    greeting: { fontSize: 24, fontWeight: 'bold', color: 'white' },
    subtitle: { color: 'rgba(255,255,255,0.7)', marginTop: 5 },
    welcome: { fontSize: 22, fontWeight: 'bold', color: '#1a2b5e' },
    sub: { textAlign: 'center', color: '#64748b', marginTop: 10 },
    section: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 15 },
    card: { backgroundColor: 'white', padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    cardBody: { flex: 1, marginLeft: 15 },
    cardName: { fontSize: 16, fontWeight: '700', color: '#1a2b5e' },
    cardInfo: { fontSize: 13, color: '#64748b', marginTop: 2 },
    empty: { textAlign: 'center', color: '#94a3b8', marginTop: 20 },
    historyCard: { flexDirection: 'row', alignItems: 'center', margin: 20, backgroundColor: '#fff7ed', borderColor: '#ffedd5', borderWidth: 1 },
    historyText: { flex: 1, marginLeft: 15, fontWeight: '600', color: '#9a3412' },
    btnMas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
    btnMasText: { color: '#64748b', fontWeight: '600' },
    footerMin: { paddingBottom: 40, alignItems: 'center' },
    footerMinText: { fontSize: 11, color: '#cbd5e1', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },

    testBanner: { margin: 20, marginBottom: 0 },
    testBannerInner: { backgroundColor: '#3b82f6', padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 15, elevation: 5 },
    testEmoji: { fontSize: 32 },
    testTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    testSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

    radarCard: { backgroundColor: 'white', padding: 20, borderRadius: 24, alignItems: 'center', elevation: 2 },

    tasksBox: { backgroundColor: 'white', padding: 15, borderRadius: 16 },
    taskItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
    taskText: { fontSize: 14, color: '#334155' },
    taskDone: { textDecorationLine: 'line-through', color: '#94a3b8' },
    taskTip: { fontSize: 10, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }
});
