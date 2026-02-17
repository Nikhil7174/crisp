// src/components/landing/ProcessFlowSection.tsx
import React from 'react';
import { Typography, Space, Grid } from 'antd';
import {
    Building2,
    FileEdit,
    Share2,
    Download,
    Sparkles,
    FileText,
    ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { spacing, borderRadius, typography } from '../../styles';

const { Title, Paragraph, Text } = Typography;

interface ProcessStep {
    number: number;
    icon: React.ReactNode;
    title: string;
    description: string;
    actor: string;
}

const ICON_SIZE = 24;
const ICON_STROKE = 1.5;

const processSteps: ProcessStep[] = [
    {
        number: 1,
        icon: <Building2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        title: 'Create Organization',
        description: 'Company or agency sets up their organization and invites recruiters and engineers to collaborate',
        actor: 'Company/Agency',
    },
    {
        number: 2,
        icon: <FileEdit size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        title: 'Design Interview',
        description: 'Recruiters create customized interviews with theoretical topics, coding problems, and evaluation criteria',
        actor: 'Recruiter/Engineer',
    },
    {
        number: 3,
        icon: <Share2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        title: 'Share Token',
        description: 'Generate and share unique interview tokens with candidates via email or recruitment platform',
        actor: 'Recruiter',
    },
    {
        number: 4,
        icon: <Download size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        title: 'Join Interview',
        description: 'Candidate downloads the Shakra app and uses the token to access their personalized interview',
        actor: 'Candidate',
    },
    {
        number: 5,
        icon: <Sparkles size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        title: 'AI Conducts Interview',
        description: 'Live voice interview with theoretical questions, coding challenges, hints, and security monitoring',
        actor: 'AI Agent',
    },
    {
        number: 6,
        icon: <FileText size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
        title: 'Review & Analyze',
        description: 'Access detailed reports with scores, conversation history, audio recordings, and security logs',
        actor: 'Recruiter/Engineer',
    },
];

export const ProcessFlowSection: React.FC = () => {
    const screens = Grid.useBreakpoint();

    return (
        <div
            id="process-flow-section"
            style={{
                background: '#FFFFFF',
                padding: `${spacing.xxxl * 1.5}px ${spacing.lg}px`,
            }}
        >
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
                            <Title
                                level={2}
                                style={{
                                    marginBottom: spacing.md,
                                    color: '#111827',
                                    fontSize: typography.fontSize['4xl'],
                                    fontWeight: typography.fontWeight.bold,
                                }}
                            >
                                How It Works
                            </Title>
                            <Paragraph
                                style={{
                                    fontSize: typography.fontSize.lg,
                                    color: '#6B7280',
                                    maxWidth: 700,
                                    margin: '0 auto',
                                    lineHeight: typography.lineHeight.relaxed,
                                }}
                            >
                                From setup to hiring decision - streamlined interview process in 6 simple steps
                            </Paragraph>
                        </div>

                        {/* Process Flow */}
                        <div style={{ position: 'relative' }}>
                            {/* Desktop Grid Layout */}
                            {screens.md && (
                                <div className="process-flow-desktop">
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                            gap: spacing.xl,
                                        }}
                                    >
                                        {processSteps.map((step, index) => (
                                            <React.Fragment key={step.number}>
                                                <motion.div
                                                    initial={{ opacity: 0, y: 30 }}
                                                    whileInView={{ opacity: 1, y: 0 }}
                                                    viewport={{ once: true }}
                                                    transition={{ delay: index * 0.1, duration: 0.5 }}
                                                    style={{ position: 'relative' }}
                                                >
                                                    <div
                                                        style={{
                                                            borderRadius: borderRadius.lg,
                                                            border: '1px solid #E5E7EB',
                                                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                                            background: '#FFFFFF',
                                                            height: '100%',
                                                            position: 'relative',
                                                            padding: spacing.xl,
                                                            paddingTop: spacing.xxl,
                                                        }}
                                                    >
                                                        {/* Step Number Badge - Overlapping */}
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                top: -16,
                                                                left: spacing.lg,
                                                                width: 32,
                                                                height: 32,
                                                                borderRadius: '50%',
                                                                background: '#3B82F6',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                border: '3px solid #FFFFFF',
                                                            }}
                                                        >
                                                            <Text
                                                                strong
                                                                style={{
                                                                    color: 'white',
                                                                    fontSize: typography.fontSize.sm,
                                                                    fontWeight: typography.fontWeight.bold,
                                                                }}
                                                            >
                                                                {step.number}
                                                            </Text>
                                                        </div>

                                                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                                            {/* Icon */}
                                                            <div
                                                                style={{
                                                                    color: '#374151',
                                                                }}
                                                            >
                                                                {step.icon}
                                                            </div>

                                                            {/* Title */}
                                                            <Title
                                                                level={4}
                                                                style={{
                                                                    margin: 0,
                                                                    color: '#111827',
                                                                    fontSize: typography.fontSize.lg,
                                                                    fontWeight: typography.fontWeight.semibold,
                                                                }}
                                                            >
                                                                {step.title}
                                                            </Title>

                                                            {/* Actor Badge */}
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    width: 'fit-content',
                                                                    padding: `4px 12px`,
                                                                    background: '#DBEAFE',
                                                                    borderRadius: borderRadius.pill,
                                                                }}
                                                            >
                                                                <Text
                                                                    style={{
                                                                        color: '#1E40AF',
                                                                        fontSize: typography.fontSize.xs,
                                                                        fontWeight: typography.fontWeight.medium,
                                                                    }}
                                                                >
                                                                    {step.actor}
                                                                </Text>
                                                            </div>

                                                            {/* Description */}
                                                            <Paragraph
                                                                style={{
                                                                    margin: 0,
                                                                    color: '#6B7280',
                                                                    fontSize: typography.fontSize.sm,
                                                                    lineHeight: typography.lineHeight.relaxed,
                                                                }}
                                                            >
                                                                {step.description}
                                                            </Paragraph>
                                                        </Space>

                                                        {/* Arrow to next step (except last in row) */}
                                                        {index % 3 !== 2 && index !== processSteps.length - 1 && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    right: -spacing.lg - 4,
                                                                    top: '50%',
                                                                    transform: 'translateY(-50%)',
                                                                    color: '#D1D5DB',
                                                                    zIndex: 1,
                                                                }}
                                                            >
                                                                <ArrowRight size={20} strokeWidth={2} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Mobile Vertical Layout */}
                            {!screens.md && (
                                <div className="process-flow-mobile">
                                    <Space direction="vertical" size={spacing.lg} style={{ width: '100%' }}>
                                        {processSteps.map((step, index) => (
                                            <motion.div
                                                key={step.number}
                                                initial={{ opacity: 0, x: -30 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: index * 0.1, duration: 0.5 }}
                                            >
                                                <div
                                                    style={{
                                                        borderRadius: borderRadius.lg,
                                                        border: '1px solid #E5E7EB',
                                                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                                        background: '#FFFFFF',
                                                        position: 'relative',
                                                        padding: spacing.lg,
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', gap: spacing.md }}>
                                                        {/* Step Number */}
                                                        <div
                                                            style={{
                                                                width: 40,
                                                                height: 40,
                                                                borderRadius: '50%',
                                                                background: '#3B82F6',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <Text
                                                                strong
                                                                style={{
                                                                    color: 'white',
                                                                    fontSize: typography.fontSize.base,
                                                                    fontWeight: typography.fontWeight.bold,
                                                                }}
                                                            >
                                                                {step.number}
                                                            </Text>
                                                        </div>

                                                        {/* Content */}
                                                        <Space direction="vertical" size="small" style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                                                <div style={{ color: '#374151' }}>
                                                                    {step.icon}
                                                                </div>
                                                                <Title
                                                                    level={5}
                                                                    style={{
                                                                        margin: 0,
                                                                        color: '#111827',
                                                                        fontSize: typography.fontSize.base,
                                                                        fontWeight: typography.fontWeight.semibold,
                                                                    }}
                                                                >
                                                                    {step.title}
                                                                </Title>
                                                            </div>

                                                            <div
                                                                style={{
                                                                    display: 'inline-block',
                                                                    padding: `4px 12px`,
                                                                    background: '#DBEAFE',
                                                                    borderRadius: borderRadius.pill,
                                                                }}
                                                            >
                                                                <Text
                                                                    style={{
                                                                        color: '#1E40AF',
                                                                        fontSize: typography.fontSize.xs,
                                                                        fontWeight: typography.fontWeight.medium,
                                                                    }}
                                                                >
                                                                    {step.actor}
                                                                </Text>
                                                            </div>

                                                            <Paragraph
                                                                style={{
                                                                    margin: 0,
                                                                    color: '#6B7280',
                                                                    fontSize: typography.fontSize.sm,
                                                                    lineHeight: typography.lineHeight.relaxed,
                                                                }}
                                                            >
                                                                {step.description}
                                                            </Paragraph>
                                                        </Space>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </Space>
                                </div>
                            )}
                        </div>
                    </Space>
                </motion.div>
            </div>
        </div>
    );
};
