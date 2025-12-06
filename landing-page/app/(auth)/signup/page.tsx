import SignupForm from '@/app/components/auth/SignupForm';
import Link from 'next/link';

export default function SignupPage() {
    return (
        <div className="flex flex-col items-center">
            <Link href="/" className="mb-8 text-2xl font-bold tracking-tighter hover:opacity-80 transition-opacity">
                indiiOS
            </Link>
            <SignupForm />
        </div>
    );
}
