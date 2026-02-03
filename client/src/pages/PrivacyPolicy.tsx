import React from 'react';
import { Typography, Card, Layout, Divider } from 'antd';

const { Title, Paragraph, Text, Link } = Typography;
const { Content } = Layout;

export const PrivacyPolicy: React.FC = () => {
    return (
        <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: '32px 0' }}>
            <Content style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
                <Card
                    style={{
                        borderRadius: 8,
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                        border: '1px solid #E5E7EB',
                    }}
                    bodyStyle={{ padding: '48px' }}
                >
                    <Typography>
                        <Title level={1} style={{ textAlign: 'center', marginBottom: 8 }}>
                            Privacy Policy
                        </Title>
                        <Paragraph style={{ textAlign: 'center', color: '#6B7280', marginBottom: 48 }}>
                            Last updated: February 3, 2026
                        </Paragraph>

                        <Title level={3}>1. Introduction</Title>
                        <Paragraph>
                            Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal information when you use our services. We are committed to ensuring transparency and safeguarding your data.
                        </Paragraph>

                        <Title level={3}>2. Information We Collect</Title>
                        <Paragraph>
                            <Text strong>Personal Information:</Text> We collect information you provide directly to us, such as when you create an account, participate in an interview, or contact support. This may include your name, email address, and interview results.
                        </Paragraph>
                        <Paragraph>
                            <Text strong>Usage Data:</Text> We automatically collect certain information about your device and how you interact with our services, such as IP address, browser type, and operating system, to help us improve our platform.
                        </Paragraph>

                        <Title level={3}>3. How We Use Your Information</Title>
                        <Paragraph>
                            We use the information we collect to:
                            <ul>
                                <li>Provide, maintain, and improve our services.</li>
                                <li>Process and generate interview feedback and scores.</li>
                                <li>Communicate with you about updates, security alerts, and support.</li>
                                <li>Monitor and analyze trends and usage to enhance user experience.</li>
                            </ul>
                        </Paragraph>

                        <Title level={3}>4. Data Sharing and Disclosure</Title>
                        <Paragraph>
                            We do not sell your personal data. We may share your information with third-party service providers (such as AI processing providers and cloud hosting services) who assist us in operating our services, conducting our business, or serving our users, so long as those parties agree to keep this information confidential.
                        </Paragraph>

                        <Title level={3}>5. Data Security</Title>
                        <Paragraph>
                            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.
                        </Paragraph>

                        <Title level={3}>6. Contact Us</Title>
                        <Paragraph>
                            If you have any questions about this Privacy Policy, please contact us at <Link href="mailto:contact@shakra.io" style={{ color: 'black', textDecoration: 'underline' }}>contact@shakra.io</Link>.
                        </Paragraph>

                        <Divider />

                        <Paragraph style={{ color: '#9CA3AF', fontSize: '12px', textAlign: 'center' }}>
                            &copy; 2026 Shakra. All rights reserved.
                        </Paragraph>
                    </Typography>
                </Card>
            </Content>
        </div>
    );
};