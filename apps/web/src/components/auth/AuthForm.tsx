'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, signup } from '../../app/auth/actions'
import { Loader2 } from 'lucide-react'

interface AuthFormProps {
    mode: 'login' | 'signup'
}

export default function AuthForm({ mode }: AuthFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = new FormData(event.currentTarget)

        try {
            const action = mode === 'login' ? login : signup
            const result = await action(formData)

            if (result?.error) {
                setError(result.error)
            }
        } catch (e) {
            setError('An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 w-full">
            {mode === 'signup' && (
                <div className="space-y-2">
                    <Label htmlFor="fullName">이름</Label>
                    <Input id="fullName" name="fullName" placeholder="홍길동" required />
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" name="email" type="email" placeholder="name@example.com" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input id="password" name="password" type="password" required />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'login' ? '로그인' : '회원가입'}
            </Button>
        </form>
    )
}
