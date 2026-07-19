importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "", // REMOVED HARDCODED KEY - Inject via build or env
    authDomain: "indii-music-founder.firebaseapp.com",
    projectId: "indii-music-founder",
    storageBucket: "indii-alpha-electron",
    messagingSenderId: "148015878263",
    appId: "1:148015878263:web:febc76c0bd56f28cdbb672",
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
