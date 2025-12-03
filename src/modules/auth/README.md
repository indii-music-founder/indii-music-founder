# Auth Module

## Purpose

The Auth Module handles user authentication and authorization. It manages login, registration, and session persistence using Firebase Auth.

## Key Components

### `Login`

The login screen allowing users to sign in via email/password or Google.

### `Register`

The registration screen for new users.

### `SelectOrg`

A screen for users to select or create an organization after logging in.

## Services

- `firebase.ts`: Initializes Firebase and exports auth instances.
- `useStore`: Manages user session state globally.
