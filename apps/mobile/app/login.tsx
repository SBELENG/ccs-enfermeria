import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { supabase } from '@ccs/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa tu email y contraseña.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (error) {
            Alert.alert('Fallo al ingresar', error.message);
            setLoading(false);
        } else {
            router.replace('/');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.inner}>
                <View style={styles.logoContainer}>
                    <Ionicons name="school" size={80} color="#1a2b5e" />
                    <Text style={styles.appTitle}>CCS v1</Text>
                    <Text style={styles.appSubtitle}>Ideas Digitales</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Contraseña"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.loginBtn}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.loginBtnText}>Ingresar</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => Alert.alert('Registro', 'Por el momento, el registro se realiza exclusivamente a través de la plataforma Web.')}
                    >
                        <Text style={styles.backBtnText}>¿No tienes cuenta? Regístrate en la Web</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Desarrollado por Ideas Digitales</Text>
                    <Text style={styles.footerVersion}>v1</Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    inner: { flex: 1, padding: 30, justifyContent: 'center' },
    logoContainer: { alignItems: 'center', marginBottom: 50 },
    appTitle: { fontSize: 32, fontWeight: '900', color: '#1a2b5e', marginTop: 10 },
    appSubtitle: { fontSize: 16, color: '#64748b', fontWeight: '600', letterSpacing: 2 },
    form: { gap: 15 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0' },
    icon: { marginRight: 10 },
    input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#1e293b' },
    loginBtn: { backgroundColor: '#1a2b5e', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 2 },
    loginBtnText: { color: 'white', fontSize: 18, fontWeight: '700' },
    backBtn: { marginTop: 20, alignItems: 'center' },
    backBtnText: { color: '#64748b', fontSize: 14 },
    footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
    footerText: { fontSize: 12, color: '#cbd5e1', fontWeight: '600' },
    footerVersion: { fontSize: 10, color: '#cbd5e1' }
});
