# **App Name**: CipherComms

## Core Features:

- Real-Time Chat: Real-time messaging with message bubbles.
- End-to-End Encryption: End-to-end encryption using Web Crypto API for secure messaging. Each message generates an AES session key, which is encrypted using the recipient's RSA public key. All keys are handled client-side, using IndexedDB.
- Secure Authentication: Secure user authentication with email/password and Google OAuth integration, ensuring secure access to messaging.
- User Search: Ability to search for other registered users in order to begin a secure, private conversation with them.

## Style Guidelines:

- Primary color: HSL(210, 70%, 50%) which converts to a vibrant blue (#3399FF), suggesting trust and security.
- Background color: Desaturated blue at HSL(210, 20%, 95%) which converts to a light gray-blue (#F0F5FA), for a clean and calming backdrop.
- Accent color: Analogous hue at HSL(180, 70%, 40%) which converts to a teal (#33B2B2) that is clearly distinct from the primary, used to signal successfully encrypted messages.
- Clean, sans-serif font for readability.
- Simple, outlined icons for user actions, ensuring clarity without visual clutter.
- WhatsApp-like layout with a clean, intuitive design. Mobile-first responsive design.