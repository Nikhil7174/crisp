import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Typography, Space, Row, Col, Upload, Tooltip } from 'antd';
import type { UploadFile } from 'antd';
import { 
  User, 
  Phone, 
  Building2, 
  Briefcase, 
  Image as ImageIcon, 
  Save,
  X,
  Inbox,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../constants/api';
import axios from 'axios';
import { useAppDispatch } from '../store';
import { setUser } from '../store/slices/authSlice';
import { colors, spacing, borderRadius, typography } from '../styles';
import { Header } from '../components/layout/Header';

const { Title, Text } = Typography;

// Design tokens matching DetailedFeedbackSheet
const dt = {
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  indigo600: '#4F46E5',
  indigo50: '#EEF2FF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
};

export const Profile: React.FC = () => {
  const { user, getFreshToken } = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null);
  const [urlInputValue, setUrlInputValue] = useState<string>('');

  useEffect(() => {
    if (user) {
      const logoUrl = user.companyLogoUrl || (user as any).company_logo_url || '';
      form.setFieldsValue({
        full_name: user.fullName || (user as any).full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        company: user.company || '',
        company_logo_url: logoUrl,
        job_role: user.jobRole || (user as any).job_role || '',
      });
      setLogoPreview(logoUrl);
      
      // If it's a base64 image, restore the uploadedFile state
      if (logoUrl && logoUrl.startsWith('data:')) {
        // Create a dummy UploadFile to show in the upload component
        const uploadFile: UploadFile = {
          uid: 'saved-logo',
          name: 'uploaded-logo.png',
          status: 'done',
        };
        setUploadedFile(uploadFile);
        setUrlInputValue('');
      } else if (logoUrl && !logoUrl.startsWith('data:')) {
        // It's a URL, not base64
        setUrlInputValue(logoUrl);
        setUploadedFile(null);
      } else {
        // No logo
        setUrlInputValue('');
        setUploadedFile(null);
      }
      setInitialLoading(false);
    }
  }, [user, form]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (file: File): Promise<boolean> => {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        message.error('Please upload an image file (PNG, JPG, etc.)');
        return false;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        message.error('Image size must be less than 2MB');
        return false;
      }

      // Convert to base64
      const base64 = await convertFileToBase64(file);
      setLogoPreview(base64);
      form.setFieldsValue({ company_logo_url: base64 });
      // Clear URL input when file is uploaded
      setUrlInputValue('');
      
      // Create UploadFile object for display
      const uploadFile: UploadFile = {
        uid: file.name,
        name: file.name,
        status: 'done',
        originFileObj: file as any,
      };
      setUploadedFile(uploadFile);
      message.success('Image uploaded successfully!');
      return false; // Prevent default upload
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Failed to upload image');
      return false;
    }
  };

  const handleRemoveImage = () => {
    setLogoPreview(null);
    setUploadedFile(null);
    form.setFieldsValue({ company_logo_url: '' });
  };

  const handleSubmit = async (values: {
    full_name?: string;
    phone?: string;
    company?: string;
    company_logo_url?: string;
    job_role?: string;
  }) => {
    setLoading(true);
    try {
      const token = await getFreshToken();
      if (!token) {
        message.error('Authentication required. Please log in again.');
        return;
      }

      // Get the current form values to ensure we have the latest company_logo_url
      // Always read directly from form to get the most up-to-date value
      const currentLogoValue = form.getFieldValue('company_logo_url');
      const logoUrl = currentLogoValue || form.getFieldsValue().company_logo_url || values.company_logo_url || '';
      
      console.log('=== Profile Save Debug ===');
      console.log('Current form field value:', currentLogoValue ? `Present (${currentLogoValue.length} chars)` : 'Empty');
      console.log('Form.getFieldsValue():', form.getFieldsValue());
      console.log('Values from onFinish:', values);
      console.log('Final logoUrl being sent:', logoUrl ? `Present (${logoUrl.length} chars, starts with: ${logoUrl.substring(0, 50)}...)` : 'Empty');
      console.log('========================');

      const response = await axios.patch(
        `${API_BASE_URL}/auth/profile`,
        {
          fullName: values.full_name || '',
          phone: values.phone || '',
          company: values.company || '',
          companyLogoUrl: logoUrl,
          jobRole: values.job_role || '',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        message.success('Profile updated successfully!');
        // Refresh user data without page reload using fresh token
        try {
          const freshToken = await getFreshToken();
          if (freshToken) {
            const userResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
              headers: {
                Authorization: `Bearer ${freshToken}`,
              },
            });
            if (userResponse.data.success) {
              // Backend now returns companyLogoUrl in the response
              // Update user in Redux store directly
              dispatch(setUser(userResponse.data.user));
              const savedLogo = userResponse.data.user?.companyLogoUrl;
              console.log('User data refreshed, logo:', savedLogo ? `Present (${savedLogo.length} chars)` : 'Missing');
            }
          }
        } catch (error) {
          console.error('Error refreshing user data:', error);
          // Even if refresh fails, update the user object locally with the saved logo
          if (user && logoUrl) {
            const updatedUser = {
              ...user,
              companyLogoUrl: logoUrl,
            };
            dispatch(setUser(updatedUser));
          }
        }
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      message.error(
        error.response?.data?.error || error.response?.data?.message || 'Failed to update profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };


  if (initialLoading) {
    return (
      <>
        <Header />
        <div style={{ 
          padding: spacing.xxxl, 
          textAlign: 'center',
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ color: dt.slate500, fontSize: typography.fontSize.base }}>
            Loading profile...
          </Text>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div style={{ 
        minHeight: '100vh',
        background: dt.slate50,
        padding: `${spacing.lg}px 0`,
      }}>
        <div style={{ 
          maxWidth: 900, 
          margin: '0 auto', 
          padding: `0 ${spacing.lg}px`,
        }}>
          {/* Header Section */}
          <div style={{ marginBottom: spacing.lg }}>
            <Title 
              level={1} 
              style={{ 
                margin: 0,
                marginBottom: spacing.xs,
                fontSize: typography.fontSize['3xl'],
                fontWeight: typography.fontWeight.bold,
                color: dt.slate900,
                letterSpacing: typography.letterSpacing.tight,
                lineHeight: typography.lineHeight.tight,
              }}
            >
              Profile Settings
            </Title>
            <Text style={{
              fontSize: typography.fontSize.sm,
              color: dt.slate600,
              lineHeight: typography.lineHeight.relaxed,
            }}>
              Complete your profile information to personalize your interview experience
            </Text>
          </div>

          {/* Main Card */}
          <Card
            style={{
              borderRadius: borderRadius.xl,
              border: `1px solid ${dt.border}`,
              boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
              background: '#FFFFFF',
              padding: 0,
            }}
            bodyStyle={{
              padding: spacing.lg,
            }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
              requiredMark={false}
            >
              {/* Personal Information Section */}
              <div style={{ marginBottom: spacing.lg }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginBottom: spacing.md,
                  paddingBottom: spacing.sm,
                  borderBottom: `1px solid ${dt.borderLight}`,
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: borderRadius.md,
                    background: `${dt.slate700}15`,
                    border: `1px solid ${dt.slate700}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <User size={16} color={dt.slate700} strokeWidth={2} />
                  </div>
                  <Text style={{
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.semibold,
                    color: dt.slate900,
                    letterSpacing: '-0.3px',
                  }}>
                    Personal Information
                  </Text>
                </div>

                <Row gutter={[spacing.md, spacing.sm]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <span style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: dt.slate700,
                        }}>
                          Full Name
                        </span>
                      }
                      name="full_name"
                    >
                      <Input
                        prefix={
                          <User 
                            size={16} 
                            color={dt.slate400} 
                            strokeWidth={2}
                            style={{ marginRight: spacing.xs }}
                          />
                        }
                        placeholder="Enter your full name"
                        allowClear
                        style={{
                          height: 40,
                          fontSize: typography.fontSize.base,
                          borderRadius: borderRadius.md,
                          borderColor: dt.slate200,
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <span style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: dt.slate700,
                        }}>
                          Job Role
                        </span>
                      }
                      name="job_role"
                    >
                      <Input
                        prefix={
                          <Briefcase 
                            size={16} 
                            color={dt.slate400} 
                            strokeWidth={2}
                            style={{ marginRight: spacing.xs }}
                          />
                        }
                        placeholder="e.g., Senior Engineer, HR Manager"
                        allowClear
                        style={{
                          height: 40,
                          fontSize: typography.fontSize.base,
                          borderRadius: borderRadius.md,
                          borderColor: dt.slate200,
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Contact Information Section */}
              <div style={{ marginBottom: spacing.lg }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginBottom: spacing.md,
                  paddingBottom: spacing.sm,
                  borderBottom: `1px solid ${dt.borderLight}`,
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: borderRadius.md,
                    background: `${dt.slate700}15`,
                    border: `1px solid ${dt.slate700}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Phone size={16} color={dt.slate700} strokeWidth={2} />
                  </div>
                  <Text style={{
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.semibold,
                    color: dt.slate900,
                    letterSpacing: '-0.3px',
                  }}>
                    Contact Information
                  </Text>
                </div>

                <Row gutter={[spacing.md, spacing.sm]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <span style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: dt.slate700,
                        }}>
                          Phone Number
                        </span>
                      }
                      name="phone"
                      rules={[
                        {
                          pattern: /^[\d\s\-\+\(\)]+$/,
                          message: 'Please enter a valid phone number',
                        },
                      ]}
                    >
                      <Input
                        prefix={
                          <Phone 
                            size={16} 
                            color={dt.slate400} 
                            strokeWidth={2}
                            style={{ marginRight: spacing.xs }}
                          />
                        }
                        placeholder="Enter your phone number"
                        allowClear
                        style={{
                          height: 40,
                          fontSize: typography.fontSize.base,
                          borderRadius: borderRadius.md,
                          borderColor: dt.slate200,
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <span style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: dt.slate700,
                        }}>
                          Email Address <span style={{ color: colors.error.main }}>*</span>
                        </span>
                      }
                      name="email"
                    >
                      <Input
                        type="email"
                        disabled
                        style={{
                          height: 40,
                          fontSize: typography.fontSize.base,
                          borderRadius: borderRadius.md,
                          backgroundColor: dt.slate50,
                          borderColor: dt.slate200,
                          color: dt.slate500,
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Professional Information Section */}
              <div style={{ marginBottom: spacing.lg }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginBottom: spacing.md,
                  paddingBottom: spacing.sm,
                  borderBottom: `1px solid ${dt.borderLight}`,
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: borderRadius.md,
                    background: `${dt.slate700}15`,
                    border: `1px solid ${dt.slate700}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Briefcase size={16} color={dt.slate700} strokeWidth={2} />
                  </div>
                  <Text style={{
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.semibold,
                    color: dt.slate900,
                    letterSpacing: '-0.3px',
                  }}>
                    Professional Information
                  </Text>
                  <Tooltip title="This data will be used for generating personalized candidate reports for the company">
                    <HelpCircle 
                      size={16} 
                      color={dt.slate500} 
                      strokeWidth={2}
                      style={{ 
                        cursor: 'help',
                        marginLeft: spacing.xs,
                      }}
                    />
                  </Tooltip>
                </div>

                <Row gutter={[spacing.md, spacing.sm]} style={{ flexDirection: 'column' }}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <span style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: dt.slate700,
                        }}>
                          Company Name
                        </span>
                      }
                      name="company"
                    >
                      <Input
                        prefix={
                          <Building2 
                            size={16} 
                            color={dt.slate400} 
                            strokeWidth={2}
                            style={{ marginRight: spacing.xs }}
                          />
                        }
                        placeholder="Enter your company name"
                        allowClear
                        style={{
                          height: 40,
                          fontSize: typography.fontSize.base,
                          borderRadius: borderRadius.md,
                          borderColor: dt.slate200,
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <span style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: dt.slate700,
                        }}>
                          Company Logo
                        </span>
                      }
                      name="company_logo_url"
                      tooltip="Upload an image file or enter a URL"
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Upload.Dragger
                          name="logo"
                          accept="image/*"
                          beforeUpload={handleImageUpload}
                          onRemove={handleRemoveImage}
                          maxCount={1}
                          fileList={uploadedFile ? [uploadedFile] : []}
                          showUploadList={true}
                          style={{
                            marginBottom: spacing.sm,
                            background: dt.slate50,
                            border: `1.5px dashed ${dt.slate200}`,
                            borderRadius: borderRadius.md,
                          }}
                          iconRender={() => <Inbox size={32} color={dt.slate400} strokeWidth={1.5} />}
                        >
                          <p style={{
                            margin: 0,
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.medium,
                            color: dt.slate700,
                            marginBottom: spacing.xs,
                          }}>
                            Click or drag image to upload
                          </p>
                          <p style={{
                            margin: 0,
                            fontSize: typography.fontSize.xs,
                            color: dt.slate500,
                          }}>
                            Support for PNG, JPG, GIF up to 2MB
                          </p>
                        </Upload.Dragger>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          padding: `${spacing.xs}px 0`,
                        }}>
                          <div style={{
                            width: 1,
                            height: 16,
                            background: dt.slate200,
                            margin: `0 ${spacing.xs}px`,
                          }} />
                          <Text style={{
                            fontSize: typography.fontSize.xs,
                            color: dt.slate500,
                            fontWeight: typography.fontWeight.medium,
                          }}>
                            OR
                          </Text>
                          <div style={{
                            width: 1,
                            height: 16,
                            background: dt.slate200,
                            margin: `0 ${spacing.xs}px`,
                          }} />
                        </div>
                        <Input
                          value={(() => {
                            const formValue = form.getFieldValue('company_logo_url');
                            // Show URL input value if it's a URL (not base64), otherwise show form value if it's a URL
                            if (formValue && !formValue.startsWith('data:')) {
                              return formValue;
                            }
                            return urlInputValue;
                          })()}
                          prefix={
                            <ImageIcon 
                              size={16} 
                              color={dt.slate400} 
                              strokeWidth={2}
                              style={{ marginRight: spacing.xs }}
                            />
                          }
                          placeholder="Enter image URL"
                          allowClear
                          onChange={(e) => {
                            const url = e.target.value;
                            setUrlInputValue(url);
                            if (url && url.trim()) {
                              setLogoPreview(url);
                              form.setFieldsValue({ company_logo_url: url });
                              setUploadedFile(null);
                            } else {
                              // Only clear if no base64 value exists
                              const formValue = form.getFieldValue('company_logo_url');
                              if (!formValue || !formValue.startsWith('data:')) {
                                setLogoPreview(null);
                                form.setFieldsValue({ company_logo_url: '' });
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const url = e.target.value;
                            if (url && url.trim()) {
                              form.setFieldsValue({ company_logo_url: url });
                            }
                          }}
                          style={{
                            height: 40,
                            fontSize: typography.fontSize.base,
                            borderRadius: borderRadius.md,
                            borderColor: dt.slate200,
                          }}
                        />
                      </Space>
                    </Form.Item>
                  </Col>
                </Row>

                {logoPreview && (
                  <Row gutter={[spacing.md, spacing.sm]}>
                    <Col xs={24}>
                      <div style={{
                        padding: spacing.md,
                        background: dt.slate50,
                        borderRadius: borderRadius.md,
                        border: `1px solid ${dt.border}`,
                        marginTop: spacing.sm,
                      }}>
                        <Text style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: dt.slate700,
                          display: 'block',
                          marginBottom: spacing.sm,
                        }}>
                          Logo Preview
                        </Text>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.md,
                        }}>
                          <div style={{
                            width: 100,
                            height: 100,
                            borderRadius: borderRadius.md,
                            border: `1px solid ${dt.border}`,
                            background: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}>
                            <img
                              src={logoPreview}
                              alt="Company Logo Preview"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                message.warning('Failed to load image. Please check the URL or upload a new image.');
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <Text style={{
                              fontSize: typography.fontSize.xs,
                              color: dt.slate500,
                              lineHeight: typography.lineHeight.relaxed,
                              display: 'block',
                              marginBottom: spacing.sm,
                            }}>
                              Your company logo will appear in interview reports and communications.
                            </Text>
                            <Button
                              size="small"
                              danger
                              icon={<X size={14} strokeWidth={2} />}
                              onClick={handleRemoveImage}
                              style={{
                                height: 32,
                                fontSize: typography.fontSize.sm,
                                borderRadius: borderRadius.md,
                              }}
                            >
                              Remove Logo
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                paddingTop: spacing.md,
                borderTop: `1px solid ${dt.borderLight}`,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: spacing.sm,
              }}>
                <Button
                  size="large"
                  onClick={() => navigate('/interviewer/dashboard')}
                  style={{
                    height: 40,
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.medium,
                    borderRadius: borderRadius.md,
                    borderColor: dt.slate200,
                    color: dt.slate700,
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  icon={<Save size={16} strokeWidth={2} />}
                  size="large"
                  style={{
                    height: 40,
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.medium,
                    borderRadius: borderRadius.md,
                    background: colors.primary.main,
                    borderColor: colors.primary.main,
                    boxShadow: '0 2px 4px rgba(9, 88, 217, 0.2)',
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </Form>
          </Card>
        </div>
      </div>
    </>
  );
};
