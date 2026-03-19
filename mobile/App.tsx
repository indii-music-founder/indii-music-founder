import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { auth } from './src/services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

/**
 * Requirement 162: React Native "On-the-go" Companion
 * Basic scaffold pointing to the critical paths of indiiOS mobile.
 */

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>indiiOS Mobile</Text>
            </View>

            <View style={styles.content}>
                {user ? (
                    <>
                        <Text style={styles.text}>Welcome back, {user.email}</Text>
                        <Text style={styles.subtitle}>Critical Paths to Scaffold:</Text>
                        <Text style={styles.listItem}>1. indii Conductor Direct Chat (Voice/Text)</Text>
                        <Text style={styles.listItem}>2. Daily Streams Dashboard (Finance)</Text>
                        <Text style={styles.listItem}>3. Offline Music Player (Item 163)</Text>
                    </>
                ) : (
                    <Text style={styles.text}>Please log in to sync your artist ecosystem.</Text>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000', // indiiOS dark theme
        justifyContent: 'center',
    },
    header: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    content: {
        flex: 1,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: '#a3a3a3',
        fontSize: 16,
        marginBottom: 20,
    },
    subtitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 10,
    },
    listItem: {
        color: '#3b82f6',
        fontSize: 16,
        marginBottom: 5,
        textAlign: 'left',
        width: '100%',
    }
});