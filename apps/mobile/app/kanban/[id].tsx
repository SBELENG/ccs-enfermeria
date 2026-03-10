import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Dimensions, Animated, ScrollView
} from 'react-native';
import { supabase } from '@ccs/supabase';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const COLUMNS = ['backlog', 'doing', 'review', 'done'] as const;
type Estado = typeof COLUMNS[number];

export default function KanbanScreen() {
    const { id } = useLocalSearchParams();
    const [tareas, setTareas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCol, setActiveCol] = useState<Estado>('backlog');

    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        async function cargar() {
            const { data } = await supabase.from('tareas').select('*').eq('equipo_id', id);
            setTareas(data || []);
            setLoading(false);
        }
        cargar();

        // Suscripción en tiempo real
        const channel = supabase.channel(`kanban-mobile-${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas', filter: `equipo_id=eq.${id}` },
                payload => {
                    if (payload.eventType === 'INSERT') setTareas(p => [...p, payload.new]);
                    if (payload.eventType === 'UPDATE') setTareas(p => p.map(t => t.id === payload.new.id ? payload.new : t));
                    if (payload.eventType === 'DELETE') setTareas(p => p.filter(t => t.id === payload.old.id));
                }
            ).subscribe();

        return () => { channel.unsubscribe(); };
    }, [id]);

    const moverTarea = async (tareaId: string, nuevoEstado: Estado) => {
        await supabase.from('tareas').update({ estado: nuevoEstado }).eq('id', tareaId);
    };

    const renderTarea = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardDesc}>{item.descripcion}</Text>
                <View style={[styles.rolTag, { backgroundColor: '#eff6ff' }]}>
                    <Text style={styles.rolText}>{item.rol_asignado}</Text>
                </View>
            </View>

            <View style={styles.actions}>
                {activeCol !== 'backlog' && (
                    <TouchableOpacity onPress={() => moverTarea(item.id, COLUMNS[COLUMNS.indexOf(activeCol) - 1])}>
                        <Ionicons name="arrow-back-circle" size={32} color="#94a3b8" />
                    </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                {activeCol !== 'done' && (
                    <TouchableOpacity onPress={() => moverTarea(item.id, COLUMNS[COLUMNS.indexOf(activeCol) + 1])}>
                        <Ionicons name="arrow-forward-circle" size={32} color="#3a6bc8" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const scrollToColumn = (index: number) => {
        flatListRef.current?.scrollToIndex({ index, animated: true });
        setActiveCol(COLUMNS[index]);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a2b5e" /></View>;

    return (
        <View style={styles.container}>
            {/* TABS ESTATAL */}
            <View style={styles.tabContainer}>
                {COLUMNS.map((col, idx) => (
                    <TouchableOpacity
                        key={col}
                        style={[styles.tab, activeCol === col && styles.activeTab]}
                        onPress={() => scrollToColumn(idx)}
                    >
                        <Text style={[styles.tabLabel, activeCol === col && styles.activeTabLabel]}>
                            {col.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                ref={flatListRef}
                data={COLUMNS}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item}
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setActiveCol(COLUMNS[index]);
                }}
                renderItem={({ item: colName }) => (
                    <View style={{ width, padding: 20 }}>
                        <View style={styles.colHeader}>
                            <Text style={styles.colTitle}>{colName.replace(/^\w/, c => c.toUpperCase())}</Text>
                            <View style={styles.badge}><Text style={styles.badgeText}>{tareas.filter(t => t.estado === colName).length}</Text></View>
                        </View>

                        <FlatList
                            data={tareas.filter(t => t.estado === colName)}
                            keyExtractor={t => t.id}
                            renderItem={renderTarea}
                            ListEmptyComponent={<Text style={styles.empty}>No hay tareas aquí</Text>}
                            contentContainerStyle={{ paddingBottom: 100 }}
                        />
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabContainer: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center' },
    activeTab: { borderBottomWidth: 3, borderBottomColor: '#3a6bc8' },
    tabLabel: { fontSize: 10, fontWeight: '700', color: '#64748b' },
    activeTabLabel: { color: '#3a6bc8' },
    colHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
    colTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
    badge: { backgroundColor: '#3a6bc8', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
    card: { backgroundColor: 'white', padding: 18, borderRadius: 20, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    cardHeader: { marginBottom: 15 },
    cardDesc: { fontSize: 15, color: '#334155', lineHeight: 22, fontWeight: '500' },
    rolTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 10 },
    rolText: { fontSize: 11, color: '#3a6bc8', fontWeight: '700', textTransform: 'uppercase' },
    actions: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
    empty: { textAlign: 'center', marginTop: 50, color: '#94a3b8', fontStyle: 'italic' }
});
