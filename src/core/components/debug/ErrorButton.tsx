// import * as Sentry from '@sentry/react'; // Unused, Sentry is initialized globally

// Add this button component to your app to test Sentry's error tracking
export function ErrorButton() {
    return (
        <button
            className="fixed bottom-20 right-4 z-[9999] bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold transition-colors"
            onClick={() => {
                throw new Error('This is your first error!');
            }}
        >
            Break the world
        </button>
    );
}
