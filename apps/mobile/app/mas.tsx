import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function MasScreen() {
    const router = useRouter();
    const year = new Date().getFullYear();

    const openLink = (url: string) => Linking.openURL(url);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Centro de Soporte</Text>
                <Text style={styles.subtitle}>En CCS e Ideas Digitales te acompañamos en tu formación.</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contacto</Text>
                <TouchableOpacity style={styles.item} onPress={() => openLink('mailto:1000ideasdigitales@gmail.com')}>
                    <Ionicons name="mail-outline" size={22} color="#1a2b5e" />
                    <Text style={styles.itemText}>Soporte Técnico</Text>
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.item} onPress={() => openLink('mailto:1000ideasdigitales@gmail.com')}>
                    <Ionicons name="globe-outline" size={22} color="#1a2b5e" />
                    <Text style={styles.itemText}>Consultas Ideas Digitales</Text>
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Legal</Text>
                <TouchableOpacity style={styles.item} onPress={() => Alert.alert('Términos y Condiciones', 'Al usar CCS aceptas el uso académico de tus datos de talento.')}>
                    <Ionicons name="document-text-outline" size={22} color="#1a2b5e" />
                    <Text style={styles.itemText}>Términos y condiciones</Text>
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.item} onPress={() => Alert.alert('Privacidad', 'Tus datos están protegidos y solo se comparten con tu cátedra.')}>
                    <Ionicons name="shield-checkmark-outline" size={22} color="#1a2b5e" />
                    <Text style={styles.itemText}>Políticas de privacidad</Text>
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cuenta</Text>
                <TouchableOpacity
                    style={[styles.item, styles.logoutItem]}
                    onPress={async () => {
                        await supabase.auth.signOut();
                        Alert.alert('Sesión cerrada', 'Has cerrado sesión correctamente.');
                        router.replace('/');
                    }}
                >
                    <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                    <Text style={[styles.itemText, { color: '#ef4444' }]}>Cerrar Sesión</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.credits}>Desarrollado por Ideas Digitales</Text>
                <Text style={styles.copy}>© {year} - Derechos reservados</Text>
                <Text style={styles.version}>v1</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { padding: 30, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1a2b5e' },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 5, lineHeight: 18 },
    section: { marginTop: 20, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
    item: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 10, elevation: 1 },
    itemText: { flex: 1, marginLeft: 15, fontSize: 16, color: '#1e293b', fontWeight: '500' },
    footer: { padding: 40, alignItems: 'center' },
    credits: { fontSize: 15, fontWeight: 'bold', color: '#1a2b5e' },
    copy: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
    version: { fontSize: 10, color: '#cbd5e1', marginTop: 15 },
    logoutItem: { borderColor: '#fee2e2', borderWidth: 1 }
});
