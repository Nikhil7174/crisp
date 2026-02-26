// src/components/landing/FeaturesSection.tsx
import React from 'react';
import { Typography, Space, Row, Col } from 'antd';
import {
    Zap,
    Settings,
    Users,
    Lightbulb,
    Eye,
    Lock,
    UserCheck,
    Volume2,
    Monitor,
    Building2,
    BarChart3,
    History
} from 'lucide-react';
import { motion } from 'framer-motion';
import { spacing, borderRadius, typography } from '../../styles';

const { Title, Paragraph, Text } = Typography;

interface Feature {
    icon: React.ReactNode;
    title: string;
    description: string;
}

interface FeatureCategory {
    id: string;
    title: string;
    description: string;
    features: Feature[];
    accentColor: string;
}

const ICON_SIZE = 20;
const ICON_STROKE = 1.5;

const featureCategories: FeatureCategory[] = [
    {
        id: 'core-features',
        title: 'Core Interview Features',
        description: 'Powerful AI-driven interview capabilities',
        accentColor: '#3B82F6',
        features: [
            {
                icon: <Zap size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Live Voice Interviews',
                description: 'Conduct detailed theoretical, puzzle, and coding interviews with natural voice interaction',
            },
            {
                icon: <Settings size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Fully Customizable',
                description: 'Design each interview uniquely with your own questions, topics, and evaluation criteria',
            },
            {
                icon: <Users size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Scale Effortlessly',
                description: 'Interview hundreds of candidates simultaneously without compromising quality',
            },
            {
                icon: <Lightbulb size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Intelligent Interactions',
                description: 'AI provides followups, hints, clarifications, and conversational coding guidance',
            },
        ],
    },
    {
        id: 'security',
        title: 'Security & Anti-Cheating',
        description: 'Enterprise-grade security monitoring',
        accentColor: '#10B981',
        features: [
            {
                icon: <Lock size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'AI Tool Blocking',
                description: 'Automatically blocks ChatGPT, Claude, and other AI assistance tools during interviews',
            },
            {
                icon: <Eye size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Eye Tracking',
                description: 'Advanced eye proctor detects when candidates look away from the interview screen',
            },
            {
                icon: <UserCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Face Detection',
                description: 'Monitors for no face, multiple faces, and unauthorized person presence',
            },
            {
                icon: <Volume2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Voice Diarization',
                description: 'Detects multiple speakers and voice changes with real-time audio alerts',
            },
        ],
    },
    {
        id: 'platform',
        title: 'Platform & Management',
        description: 'Complete interview management ecosystem',
        accentColor: '#8B5CF6',
        features: [
            {
                icon: <Monitor size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Cross-Platform App',
                description: 'Desktop application supports Windows, macOS, and Linux for candidates',
            },
            {
                icon: <Building2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Organization Management',
                description: 'Companies create orgs, add recruiters/engineers, and collaborate seamlessly',
            },
            {
                icon: <BarChart3 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Detailed Reports',
                description: 'Access comprehensive scores, analytics, and performance insights',
            },
            {
                icon: <History size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
                title: 'Complete Audit Trail',
                description: 'View conversation history, security logs, and candidate feedback',
            },
        ],
    },
];

export const FeaturesSection: React.FC = () => {
    return (
        <div
            id="features-section"
            style={{
                background: '#fff',
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
                                Complete Interview Solution
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
                                Everything you need to conduct secure, intelligent, and scalable AI-powered interviews
                            </Paragraph>
                        </div>

                        {/* Feature Categories */}
                        <Space direction="vertical" size={spacing.xxl} style={{ width: '100%' }}>
                            {featureCategories.map((category, categoryIndex) => (
                                <motion.div
                                    key={categoryIndex}
                                    id={`features-${category.id}`}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: categoryIndex * 0.1, duration: 0.5 }}
                                >
                                    <div
                                        style={{
                                            borderRadius: borderRadius.lg,
                                            border: '1px solid #E5E7EB',
                                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                            background: '#FFFFFF',
                                            overflow: 'hidden',
                                            padding: spacing.xxl,
                                        }}
                                    >
                                        {/* Category Header */}
                                        <div style={{ marginBottom: spacing.xl, display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                                            <div
                                                style={{
                                                    width: 4,
                                                    minHeight: 48,
                                                    background: category.accentColor,
                                                    borderRadius: borderRadius.sm,
                                                    marginTop: 4,
                                                }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <Title
                                                    level={3}
                                                    style={{
                                                        margin: 0,
                                                        marginBottom: spacing.xs,
                                                        color: '#111827',
                                                        fontSize: typography.fontSize['2xl'],
                                                        fontWeight: typography.fontWeight.bold,
                                                    }}
                                                >
                                                    {category.title}
                                                </Title>
                                                <Paragraph
                                                    style={{
                                                        margin: 0,
                                                        color: '#6B7280',
                                                        fontSize: typography.fontSize.base,
                                                    }}
                                                >
                                                    {category.description}
                                                </Paragraph>
                                            </div>
                                        </div>

                                        {/* Features Grid */}
                                        <Row gutter={[spacing.lg, spacing.lg]}>
                                            {category.features.map((feature, featureIndex) => (
                                                <Col xs={24} sm={24} md={12} lg={12} key={featureIndex}>
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.98 }}
                                                        whileInView={{ opacity: 1, scale: 1 }}
                                                        viewport={{ once: true }}
                                                        transition={{ delay: featureIndex * 0.05, duration: 0.3 }}
                                                    >
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                gap: spacing.md,
                                                                alignItems: 'flex-start',
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    flexShrink: 0,
                                                                    marginTop: 2,
                                                                    color: '#374151',
                                                                }}
                                                            >
                                                                {feature.icon}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <Text
                                                                    strong
                                                                    style={{
                                                                        display: 'block',
                                                                        marginBottom: spacing.xs,
                                                                        color: '#111827',
                                                                        fontSize: typography.fontSize.base,
                                                                        fontWeight: typography.fontWeight.semibold,
                                                                    }}
                                                                >
                                                                    {feature.title}
                                                                </Text>
                                                                <Text
                                                                    style={{
                                                                        color: '#6B7280',
                                                                        fontSize: typography.fontSize.sm,
                                                                        lineHeight: typography.lineHeight.relaxed,
                                                                    }}
                                                                >
                                                                    {feature.description}
                                                                </Text>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </Col>
                                            ))}
                                        </Row>
                                    </div>
                                </motion.div>
                            ))}
                        </Space>
                    </Space>
                </motion.div>
            </div>
        </div>
    );
};
