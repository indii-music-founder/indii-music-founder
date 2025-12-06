import LoginForm from '@/app/components/auth/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
    return (
        <div className="flex flex-col items-center">
            <Link href="/" className="mb-8 text-2xl font-bold tracking-tighter hover:opacity-80 transition-opacity">
                indiiOS
            </Link>
            <LoginForm />
        </div>
    );
}
