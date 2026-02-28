'use client';

import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';

interface LoginButtonProps {
    provider: 'google' | 'github' | 'kakao' | 'azure'; // Add more as needed
    children: ReactNode;
    className?: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'social';
    size?: 'default' | 'sm' | 'lg' | 'icon' | 'social';
}

export default function LoginButton({
    provider,
    children,
    className,
    variant = 'default',
    size = 'default',
}: LoginButtonProps) {
    const handleLogin = async () => {
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
        } catch (error) {
            console.error('Login error:', error);
            alert('로그인 중 오류가 발생했습니다.');
        }
    };


    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleLogin}
        >
            {children}
        </Button>
    );
}
