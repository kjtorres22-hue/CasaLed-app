// ⚠️ Pega aquí la configuración de TU proyecto de Firebase.
// La encuentras en: Consola de Firebase → ⚙️ Configuración del proyecto → General → "Tus apps" → App web → SDK setup and configuration → Config.
// Estos datos NO son secretos: la seguridad la dan las reglas de Firestore (firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyCXKwM5-E9HGyAHwzeeqGVwfWKt3n8mWgA",
  authDomain: "casa-led-262ad.firebaseapp.com",
  projectId: "casa-led-262ad",
  storageBucket: "casa-led-262ad.firebasestorage.app",
  messagingSenderId: "226678281038",
  appId: "1:226678281038:web:20f44c7b9448759461441f"
};

// Correo del dueño: la primera cuenta creada con este correo queda como Administrador.
// Debe coincidir con OWNER_EMAIL en firestore.rules.
export const OWNER_EMAIL = "kjtorres22@gmail.com";

// Solo para pruebas locales con el emulador de Firebase. Déjalo en false.
export const USE_EMULATORS = false;
