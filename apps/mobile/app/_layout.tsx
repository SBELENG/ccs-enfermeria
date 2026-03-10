import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
    return (
        <>
            <StatusBar style="light" backgroundColor="#1a2b5e" />
            <Stack
                screenOptions={{
                    headerStyle: { backgroundColor: '#1a2b5e' },
                    headerTintColor: '#ffffff',
                    headerTitleStyle: { fontFamily: 'Syne-Bold', fontSize: 17 },
                    contentStyle: { backgroundColor: '#f8fafb' },
                    animation: 'slide_from_right',
                }}
            >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="test/index" options={{ title: 'Test de Perfil' }} />
                <Stack.Screen name="catedra/[id]" options={{ title: 'Cátedra' }} />
                <Stack.Screen name="equipo/[id]" options={{ title: 'Equipo' }} />
                <Stack.Screen name="kanban/[id]" options={{ title: 'Sprint Board' }} />
                <Stack.Screen name="mas" options={{ title: 'Más' }} />
            </Stack>
        </>
    );
}
