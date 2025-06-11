// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBlFR5HxLDudUw9tOniuLyPSTb_VF0T-Yo",
  authDomain: "sara-chat-c4fb0.firebaseapp.com",
  projectId: "sara-chat-c4fb0",
  storageBucket: "sara-chat-c4fb0.firebasestorage.app",
  messagingSenderId: "1064019652325",
  appId: "1:1064019652325:web:36c987539d13b460a36e0c",
  measurementId: "G-6SB79KJ3Z2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Analytics can be initialized if/when needed
