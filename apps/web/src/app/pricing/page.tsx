'use client';

import TopNav from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

export default function PricingPage() {
    const router = useRouter();

    const plans = [
        {
            name: 'Beginner',
            badge: '무료',
            badgeColor: 'bg-secondary-100 text-secondary-700',
            price: '₩0',
            period: '/ 월',
            description: '영어 쉐도잉 학습을 시작하는 분들을 위한 기본 플랜',
            features: [
                '기본 영상 학습 기능',
                '문장 단위 반복 재생',
                '스크립트 보기',
                '진행률 추적',
                '하이라이트 저장 (최대 10개)',
            ],
            buttonText: '현재 플랜',
            buttonStyle: 'bg-secondary-200 text-secondary-600 cursor-not-allowed',
            isActive: true,
        },
        {
            name: 'Intermediate',
            badge: '인기',
            badgeColor: 'bg-primary-100 text-primary-700',
            price: '₩9,900',
            period: '/ 월',
            description: '본격적인 학습을 원하는 분들을 위한 프리미엄 플랜',
            features: [
                'Beginner 플랜의 모든 기능',
                '무제한 하이라이트 저장',
                '문장 저장 및 복습 기능',
                'AI 발음 분석 및 피드백',
                '학습 통계 및 대시보드',
                '우선 고객 지원',
            ],
            buttonText: '업그레이드',
            buttonStyle: 'bg-neutral-900 hover:bg-neutral-800 text-white',
            isActive: false,
        },
        {
            name: 'Master',
            badge: '프로',
            badgeColor: 'bg-neutral-900 text-white',
            price: '₩19,900',
            period: '/ 월',
            description: '최고의 학습 경험을 원하는 전문가를 위한 플랜',
            features: [
                'Intermediate 플랜의 모든 기능',
                '맞춤형 AI 학습 코칭',
                '개인 맞춤 학습 계획',
                '고급 발음 교정 및 억양 분석',
                '전문가 1:1 상담 (월 1회)',
                '오프라인 학습 모드',
                '광고 없는 학습 환경',
            ],
            buttonText: '업그레이드',
            buttonStyle: 'bg-neutral-900 hover:bg-neutral-800 text-white',
            isActive: false,
        },
    ];

    const handleUpgrade = (planName: string) => {
        // TODO: Implement payment integration
        console.log(`Upgrading to ${planName} plan`);
    };

    return (
        <div className="min-h-screen bg-secondary-200 flex flex-col">
            <TopNav />
            <main className="flex-1 max-w-[1200px] w-full mx-auto p-8 flex flex-col gap-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-neutral-900 mb-4">플랜 업그레이드</h1>
                    <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
                        당신의 학습 목표에 맞는 최적의 플랜을 선택하세요. 언제든지 변경 가능합니다.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className="bg-surface rounded-2xl p-6 border-2 border-secondary-200 shadow-sm flex flex-col transition-all hover:scale-105 hover:border-primary-400 hover:shadow-lg"
                        >
                            {/* Plan Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold text-neutral-900">{plan.name}</h2>
                                <span className={`px-3 py-1 ${plan.badgeColor} text-xs font-semibold rounded-full`}>
                                    {plan.badge}
                                </span>
                            </div>

                            {/* Price */}
                            <div className="mb-4">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-neutral-900">{plan.price}</span>
                                    <span className="text-lg text-secondary-500">{plan.period}</span>
                                </div>
                                <p className="text-sm text-secondary-600 mt-2">{plan.description}</p>
                            </div>

                            {/* Features */}
                            <div className="flex-1 mb-6">
                                <ul className="space-y-3">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <svg
                                                className="w-5 h-5 text-primary-500 shrink-0 mt-0.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M5 13l4 4L19 7"
                                                />
                                            </svg>
                                            <span className="text-sm text-neutral-700">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA Button */}
                            <Button
                                onClick={() => handleUpgrade(plan.name)}
                                disabled={plan.isActive}
                                variant={plan.isActive ? 'default' : undefined}
                                className={`w-full font-semibold py-3 rounded-xl transition-all ${plan.buttonStyle}`}
                            >
                                {plan.buttonText}
                            </Button>
                        </div>
                    ))}
                </div>

                {/* FAQ Section */}
                <div className="bg-surface rounded-2xl p-6 border border-secondary-200 shadow-sm mt-8">
                    <h2 className="text-2xl font-semibold text-neutral-900 mb-4">자주 묻는 질문</h2>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-base font-semibold text-neutral-900">
                                플랜은 언제든지 변경할 수 있나요?
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-secondary-600">
                                네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 변경 사항은 다음 결제
                                주기부터 적용됩니다.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger className="text-base font-semibold text-neutral-900">
                                환불 정책은 어떻게 되나요?
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-secondary-600">
                                결제 후 7일 이내에 서비스를 사용하지 않으셨다면 전액 환불이 가능합니다.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger className="text-base font-semibold text-neutral-900">
                                결제 수단은 무엇이 있나요?
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-secondary-600">
                                신용카드, 체크카드, 계좌이체 등 다양한 결제 수단을 지원합니다.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </main>
        </div>
    );
}
