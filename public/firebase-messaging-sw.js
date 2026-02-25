importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "", // REMOVED HARDCODED KEY - Inject via build or env
    authDomain: "indiios-v-1-1.firebaseapp.com",
    projectId: "indiios-v-1-1",
    storageBucket: "indiios-alpha-electron",
    messagingSenderId: "223837784072",
    appId: "1:223837784072:web:28eabcf0c5dd985395e9bd",
    measurementId: "G-KNWPRGE5JK"
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        // Customize notification handling here if needed
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: '/icons/icon-192x192.png',
            data: payload.data
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (error) {
    console.error('Firebase messaging verification failed', error);
}
