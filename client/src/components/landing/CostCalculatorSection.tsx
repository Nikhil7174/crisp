// src/components/landing/CostCalculatorSection.tsx
import React, { useState, useMemo } from 'react';
import { Typography, Space, Row, Col, Button, Tabs, Select, Grid } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { colors, spacing, typography, borderRadius } from '../../styles';
import './CostCalculatorSection.css';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

type ViewType = 'financial' | 'time';
type Country = 'india' | 'usa';
type Scenario = 'best' | 'mid' | 'worst';

// 🇮🇳 INDIA MARKET DATA (Real-world Benchmarks)
// Source: Naukri / AmbitionBox / Glassdoor 2024
const INDIA_CONSTANTS = {
  SCREENS_PER_HIRE: 15,          // Higher volume of resumes/spam in India
  ENG_COST_PER_SCREEN: {
    best: 1300,   // ₹1,300 (Best case - lower end of range)
    mid: 2150,    // ₹2,150 (Mid case - average)
    worst: 3000   // ₹3,000 (Worst case - higher end of range)
  },
  // Cost breakdown percentages for per-interview cost
  COST_BREAKDOWN: {
    fixed: 0.10,    // 10% - Internal Vendor Management & Review
    running: 0.05,  // 5% - Platform Subscription & Integration
    variable: 0.85  // 85% - The Per-Interview Fee
  },
  AI_COST_PER_SCREEN: 399,       // ₹399 (Per-session cost - everything included)
  MONTHLY_SUBSCRIPTION: 20000,   // ₹20,000 (Sweet spot for Indian SMBs)
  ENG_HOURS_PER_SCREEN: 1.5,     // Avg time for Prep + Interview + Debrief
  TIME_TO_HIRE_DAYS_MANUAL: {
    best: 1.5,   // Freelance Panel: 1-2 Days (avg 1.5)
    mid: 2,      // Specialized Agency: 2 Days
    worst: 5     // Internal Dev Team: 4-6 Days (avg 5)
  },
  TIME_TO_HIRE_DAYS_AI: 0.5,     // < 12 Hours (0.5 days)
};

// 🇺🇸 USA MARKET DATA (Real-world Benchmarks)
// Source: SHRM / BuiltIn / Glassdoor 2024
const USA_CONSTANTS = {
  SCREENS_PER_HIRE: 8,           // Lower volume, higher quality sourcing
  ENG_COST_PER_SCREEN: {
    best: 145,    // $145 (Best case - lower end of range)
    mid: 250.5,   // $250.5 (Mid case - average)
    worst: 356    // $356 (Worst case - higher end of range)
  },
  // Cost breakdown percentages for per-interview cost
  COST_BREAKDOWN: {
    fixed: 0.10,    // 10% - Internal Vendor Management & Review
    running: 0.15,  // 15% - Platform Subscription & Integration
    variable: 0.75  // 75% - The Per-Interview Fee
  },
  AI_COST_PER_SCREEN: 10,        // $10 (Per-session cost - everything included)
  MONTHLY_SUBSCRIPTION: 499,     // $499/mo (Standard B2B SaaS starter pricing)
  ENG_HOURS_PER_SCREEN: 2.5,     // US interviews are often deeper/longer
  TIME_TO_HIRE_DAYS_MANUAL: {
    best: 4,      // Freelance Panel: 3-5 Days (avg 4)
    mid: 2.5,    // Specialized Agency: 2-3 Days (avg 2.5)
    worst: 6     // Internal Dev Team: 5-7 Days (avg 6)
  },
  TIME_TO_HIRE_DAYS_AI: 1,       // < 24 Hours (1 day)
};

const CostCalculatorSection: React.FC = () => {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const screens = useBreakpoint();
  const [numHires, setNumHires] = useState<number>(80);
  const [activeView, setActiveView] = useState<ViewType>('time');
  const [country, setCountry] = useState<Country>('india');
  const [scenario, setScenario] = useState<Scenario>('worst');
  const [hoveredSegment, setHoveredSegment] = useState<{ barIndex: number; segmentKey: string } | null>(null);

  // Get country-specific constants
  const constants = country === 'india' ? INDIA_CONSTANTS : USA_CONSTANTS;

  const rowGutter: [number, number] = (() => {
    if (screens.lg) return [spacing.xxxl * 2, spacing.xxxl];
    if (screens.sm) return [spacing.xxxl, spacing.xxxl];
    return [spacing.xl, spacing.xxl]; // xs / very small screens
  })();

  // Calculate costs based on number of hires
  const calculations = useMemo(() => {
    const engCostPerHire = constants.ENG_COST_PER_SCREEN[scenario]; // Cost per hire (not per screen)
    const costBreakdown = constants.COST_BREAKDOWN;

    // Break down the per-hire cost into Fixed, Running, and Variable
    // For 1 hire, total cost = engCostPerHire (e.g., ₹1300), split into three categories
    const fixedCostPerHire = engCostPerHire * costBreakdown.fixed;
    const runningCostPerHire = engCostPerHire * costBreakdown.running;
    const variableCostPerHire = engCostPerHire * costBreakdown.variable;

    // Financial Cost calculations (all costs are per-hire based)
    const manualFixedCost = numHires * fixedCostPerHire; // Annual (sum of all per-hire fixed costs)
    const manualRunningCost = numHires * runningCostPerHire; // Annual (sum of all per-hire running costs)
    const manualVariableCost = numHires * variableCostPerHire; // Annual (sum of all per-hire variable costs)
    const manualTotal = manualFixedCost + manualRunningCost + manualVariableCost;

    // Shakra charges per hire - everything included in one price
    const shakraPerSessionCost = numHires * constants.AI_COST_PER_SCREEN;
    const shakraTotal = shakraPerSessionCost; // Total is just per-hire cost (no fixed/running costs)

    const annualSavings = manualTotal - shakraTotal;
    const monthlySavings = annualSavings / 12;

    // Time/Productivity calculations
    // Engineering hours = number of interviews * hours per interview
    const manualEngHours = numHires * constants.ENG_HOURS_PER_SCREEN;
    const shakraEngHours = numHires * 0.1; // Minimal engineering time with AI
    const engHoursSaved = manualEngHours - shakraEngHours;

    const manualTimeToHire = numHires * constants.TIME_TO_HIRE_DAYS_MANUAL[scenario];
    const shakraTimeToHire = numHires * constants.TIME_TO_HIRE_DAYS_AI;
    const daysSaved = manualTimeToHire - shakraTimeToHire;

    return {
      financial: {
        manual: {
          fixedCost: manualFixedCost, // Annual
          variableCost: manualVariableCost, // Annual
          runningCost: manualRunningCost, // Annual
          total: manualTotal, // Annual
        },
        shakra: {
          perSessionCost: shakraPerSessionCost, // Annual - only per-session cost, everything included
          total: shakraTotal, // Annual
        },
        annualSavings,
        monthlySavings, // Monthly savings for display only
      },
      time: {
        manual: {
          engHours: manualEngHours,
          timeToHire: manualTimeToHire,
          total: manualEngHours + (manualTimeToHire * 8), // Convert days to hours
        },
        shakra: {
          engHours: shakraEngHours,
          timeToHire: shakraTimeToHire,
          savings: engHoursSaved + (daysSaved * 8),
          total: shakraEngHours + (shakraTimeToHire * 8),
        },
        engHoursSaved,
        daysSaved,
      },
    };
  }, [numHires, country, scenario]);

  const chartData = useMemo(() => {
    if (activeView === 'financial') {
      const calc = calculations.financial;
      const manualTotal = calc.manual.fixedCost + calc.manual.variableCost + calc.manual.runningCost;
      const shakraCostTotal = calc.shakra.perSessionCost; // Shakra only has per-session cost
      const savings = manualTotal - shakraCostTotal; // Savings is the difference

      return [
        {
          name: 'Manual Hiring',
          'Fixed Cost': calc.manual.fixedCost,
          'Per-Session Cost': calc.manual.variableCost,
          'Running Cost': calc.manual.runningCost,
        },
        {
          name: 'Shakra AI',
          'Per-Session Cost': calc.shakra.perSessionCost,
          'Savings': Math.max(0, savings), // Ensure savings is positive
        },
      ];
    } else {
      const calc = calculations.time;
      // Time data in actual hours
      const manualTotal = calc.manual.engHours + (calc.manual.timeToHire * 8); // Convert days to hours
      const shakraCostTotal = calc.shakra.engHours + (calc.shakra.timeToHire * 8); // Convert days to hours
      const savings = manualTotal - shakraCostTotal;

      return [
        {
          name: 'Manual Hiring',
          'Eng. Time': calc.manual.engHours,
          'Time to Hire': calc.manual.timeToHire * 8, // Convert days to hours
        },
        {
          name: 'Shakra AI',
          'Eng. Time': calc.shakra.engHours,
          'Time to Hire': calc.shakra.timeToHire * 8, // Convert days to hours
          'Savings': Math.max(0, savings),
        },
      ];
    }
  }, [calculations, activeView]);


  const formatCurrency = (value: number) => {
    if (country === 'usa') {
      // USA formatting with $
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}k`;
      }
      return `$${Math.round(value)}`;
    } else {
      // India formatting with ₹
      if (value >= 100000) {
        return `₹${(value / 100000).toFixed(1)}L`;
      } else if (value >= 1000) {
        return `₹${(value / 1000).toFixed(1)}k`;
      }
      return `₹${Math.round(value)}`;
    }
  };

  const formatNumber = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return Math.round(value).toString();
  };

  const currentCalc = calculations[activeView];

  return (
    <div
      className="cost-calculator-section"
      style={{
        background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)',
        padding: `${spacing.xxxl * 1.5}px ${spacing.xl}px ${spacing.xxxl * 2.5}px ${spacing.xl}px`,
        // marginTop: spacing.xxl,
        overflowX: 'hidden',
        overflowY: 'hidden',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', overflowX: 'hidden', overflowY: 'hidden', boxSizing: 'border-box' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ width: '100%', overflowX: 'hidden', overflowY: 'hidden', willChange: 'transform' }}
        >
          {/* Top Row - Controls Alignment */}
          <Row gutter={[spacing.xxxl, spacing.lg]} align="middle" style={{ marginBottom: spacing.xl }}>
            <Col xs={24} lg={10}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                flexWrap: 'wrap',
              }}
                className="cost-calculator-controls">
                {/* Scenario Selector Dropdown */}
                <Select
                  value={scenario}
                  onChange={(value) => setScenario(value as Scenario)}
                  size="large"
                  className="cost-calculator-select"
                  style={{ width: 250 }}
                >
                  <Option value="best">Freelance Marketplace</Option>
                  <Option value="mid">Internal Hiring Team</Option>
                  <Option value="worst">Specialized Agency</Option>
                </Select>
                {/* Country Selector Dropdown */}
                <Select
                  value={country}
                  onChange={(value) => setCountry(value as Country)}
                  className="cost-calculator-select"
                  style={{ width: 140, minWidth: 120 }}
                  size="large"
                >
                  <Option value="india">India (INR)</Option>
                  <Option value="usa">USA (USD)</Option>
                </Select>
              </div>
            </Col>
            <Col xs={24} lg={14}>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: spacing.md,
                flexWrap: 'wrap',
              }}
                className="cost-calculator-tabs-wrap">
                <Tabs
                  activeKey={activeView}
                  onChange={(key) => setActiveView(key as ViewType)}
                  className="cost-calculator-tabs"
                  size="middle"
                  items={[
                    {
                      key: 'time',
                      label: 'Time/Productivity saved',
                    },
                    {
                      key: 'financial',
                      label: 'Financial Cost saved',
                    },
                  ]}
                />
              </div>
            </Col>
          </Row>

          <Row gutter={rowGutter} align="middle">
            {/* Left Column - Headline and Savings */}
            <Col xs={24} lg={11} style={{ paddingRight: spacing.md }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Title
                    level={1}
                    className="cost-calculator-title"
                    style={{
                      fontSize: typography.fontSize['5xl'],
                      fontWeight: typography.fontWeight.bold,
                      color: colors.neutral[900],
                      marginBottom: spacing.md,
                      lineHeight: typography.lineHeight.tight,
                    }}
                  >
                    {activeView === 'financial' ? (
                      <>
                        Expert-Level Interviews.{' '}
                        <span style={{ color: colors.success.main }}>Pocket-Friendly</span> Prices.
                      </>
                    ) : (
                      <>
                        Let your <span style={{ color: colors.success.main }}>Devs Build</span> and Shakra Interview.
                      </>
                    )}
                  </Title>
                  <Paragraph
                    style={{
                      fontSize: typography.fontSize.lg,
                      color: colors.neutral[600],
                      marginBottom: spacing.xl,
                    }}
                  >
                    Run the numbers for your team and see the results.
                  </Paragraph>
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.neutral[500],
                      fontStyle: 'italic',
                    }}
                  >
                    Based on {scenario === 'best' ? 'Freelance Marketplace' : scenario === 'mid' ? 'Internal Hiring Team' : 'Specialized Agency'} scenario
                  </Text>
                </div>

                {/* Savings Display */}
                <div
                  className="cost-calculator-savings"
                  style={{
                    display: 'flex',
                    gap: spacing.xl,
                    marginBottom: spacing.xl,
                  }}
                >
                  <div>
                    <Text
                      className="cost-calculator-savings-value"
                      style={{
                        fontSize: typography.fontSize['4xl'],
                        fontWeight: typography.fontWeight.bold,
                        color: colors.success.main,
                        display: 'block',
                      }}
                    >
                      {activeView === 'financial'
                        ? formatCurrency('annualSavings' in currentCalc ? currentCalc.annualSavings : 0)
                        : `${formatNumber('engHoursSaved' in currentCalc ? currentCalc.engHoursSaved : 0)} hrs`}
                    </Text>
                    <Text
                      className="cost-calculator-savings-label"
                      style={{
                        fontSize: typography.fontSize.base,
                        color: colors.neutral[600],
                        display: 'block',
                        marginTop: spacing.xs,
                      }}
                    >
                      {activeView === 'financial' ? 'Annual Savings' : 'Eng. Hours Saved'}
                    </Text>
                  </div>
                  <div className="cost-calculator-savings-divider" style={{ width: 1, background: colors.neutral[300] }} />
                  <div>
                    <Text
                      className="cost-calculator-savings-value"
                      style={{
                        fontSize: typography.fontSize['4xl'],
                        fontWeight: typography.fontWeight.bold,
                        color: colors.success.main,
                        display: 'block',
                      }}
                    >
                      {activeView === 'financial'
                        ? formatCurrency('monthlySavings' in currentCalc ? currentCalc.monthlySavings : 0)
                        : `${'daysSaved' in currentCalc ? currentCalc.daysSaved : 0} days`}
                    </Text>
                    <Text
                      className="cost-calculator-savings-label"
                      style={{
                        fontSize: typography.fontSize.base,
                        color: colors.neutral[600],
                        display: 'block',
                        marginTop: spacing.xs,
                      }}
                    >
                      {activeView === 'financial' ? 'Monthly Savings' : 'Time to Hire Saved'}
                    </Text>
                  </div>
                </div>

                {/* CTA */}
                <Button
                  type="primary"
                  size="large"
                  onClick={() => {
                    posthog?.capture('talk_to_us_clicked');
                    navigate('/contact');
                  }}
                  style={{
                    background: colors.success.main,
                    borderColor: colors.success.main,
                    height: 48,
                    fontSize: typography.fontSize.base,
                    fontWeight: typography.fontWeight.medium,
                    borderRadius: borderRadius.lg,
                    padding: `${spacing.xs}px ${spacing.xxl}px`,
                  }}
                >
                  Talk to us →
                </Button>
              </Space>
            </Col>

            {/* Right Column - Slider and Chart */}
            <Col xs={24} lg={13} style={{ overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
              <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
                {/* Number of Hires Slider */}
                <div style={{ marginBottom: spacing.xl }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: spacing.md,
                    }}
                  >
                    <Text
                      className="cost-calculator-slider-label"
                      style={{
                        fontSize: typography.fontSize.base,
                        color: colors.neutral[600],
                        fontWeight: typography.fontWeight.medium,
                      }}
                    >
                      Number of interviews taken per Year
                    </Text>
                    <Text
                      className="cost-calculator-slider-value"
                      style={{
                        fontSize: typography.fontSize.lg,
                        color: colors.primary.main,
                        fontWeight: typography.fontWeight.bold,
                      }}
                    >
                      {numHires}
                    </Text>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    value={numHires}
                    onChange={(e) => setNumHires(Number(e.target.value))}
                    style={{
                      width: '100%',
                      height: 32,
                      borderRadius: borderRadius.xl,
                      background: `linear-gradient(to right, ${colors.primary.main} 0%, ${colors.primary.main} ${((numHires - 10) / 490) * 100}%, ${colors.neutral[300]} ${((numHires - 10) / 490) * 100}%, ${colors.neutral[300]} 100%)`,
                      outline: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                    className="slider-input"
                  />
                  <style>{`
                    .slider-input::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 40px;
                      height: 40px;
                      border-radius: 50%;
                      background: ${colors.background.primary};
                      border: 2px solid ${colors.primary.main};
                      cursor: pointer;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                    .slider-input::-moz-range-thumb {
                      width: 40px;
                      height: 40px;
                      border-radius: 50%;
                      background: ${colors.background.primary};
                      border: 2px solid ${colors.primary.main};
                      cursor: pointer;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                      -moz-appearance: none;
                      appearance: none;
                    }
                    .slider-input::-moz-range-track {
                      height: 32px;
                      border-radius: ${borderRadius.xl};
                      background: transparent;
                    }
                  `}</style>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: spacing.xs,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.neutral[500],
                      }}
                    >
                      10
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.neutral[500],
                      }}
                    >
                      500
                    </Text>
                  </div>
                </div>

                {/* Chart */}
                <div
                  className="cost-calculator-chart"
                  style={{
                    background: colors.background.primary,
                    padding: spacing.xl,
                    borderRadius: borderRadius.xl,
                    boxShadow: colors.shadows.md,
                    position: 'relative',
                    width: '100%',
                    maxWidth: '100%',
                    overflowX: 'hidden',
                    boxSizing: 'border-box',
                  }}
                >
                  <style>{`
                    .recharts-bar-rectangle {
                      transition: fill 0.2s ease !important;
                      cursor: pointer;
                    }
                    /* Remove global hover styles that conflict with custom hover colors */
                    /* Custom hover is handled via fill attribute in shape functions */
                    .recharts-legend-wrapper {
                      display: flex !important;
                      justify-content: center !important;
                      gap: ${spacing.md}px !important;
                    }
                    .recharts-legend-item {
                      margin: 0 12px !important;
                      font-size: 14px !important;
                    }
                  `}</style>
                  <div style={{ width: '100%', maxWidth: '90%', margin: '0 auto', overflowX: 'hidden', overflowY: 'hidden', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: colors.neutral[600], fontSize: typography.fontSize.sm }}
                        />
                        <YAxis
                          tick={{
                            fill: colors.neutral[600],
                            fontSize: typography.fontSize.sm,
                          }}
                          tickFormatter={(value: number) => {
                            if (activeView === 'financial') {
                              // Format large numbers more compactly
                              if (value >= 1000) {
                                const formatted = country === 'usa'
                                  ? `$${(value / 1000).toFixed(0)}k`
                                  : `₹${(value / 1000).toFixed(0)}k`;
                                return formatted;
                              }
                              return country === 'usa' ? `$${value}` : `₹${value}`;
                            }
                            // Format hours
                            if (value >= 1000) {
                              return `${(value / 1000).toFixed(1)}k`;
                            }
                            return `${Math.round(value)}`;
                          }}
                          width={60}
                          domain={[0, 'auto']}
                          label={{
                            value: activeView === 'financial'
                              ? 'Total cost of ownership (annual)'
                              : 'Time (hours)',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 0,
                            style: { fill: colors.neutral[500], fontSize: typography.fontSize.sm, textAnchor: 'middle' },
                          }}
                        />
                        <Tooltip
                          contentStyle={{ display: 'none' }}
                          cursor={false}
                        />
                        <Legend
                          wrapperStyle={{
                            paddingTop: spacing.lg,
                            display: 'flex',
                            justifyContent: 'center',
                            gap: spacing.xl,
                          }}
                          iconType="circle"
                        />
                        <Bar
                          dataKey={activeView === 'financial' ? 'Fixed Cost' : 'Eng. Time'}
                          stackId="a"
                          maxBarSize={90}
                          fill="#2c2c2c"
                          name={activeView === 'financial' ? 'Fixed Cost' : 'Eng. Time'}
                          shape={(props: any) => {
                            const segmentKey = activeView === 'financial' ? 'Fixed Cost' : 'Eng. Time';
                            const barIndex = chartData.findIndex((d: any) => d.name === props.payload?.name);
                            const isHovered = hoveredSegment?.barIndex === barIndex && hoveredSegment?.segmentKey === segmentKey;
                            return (
                              <rect
                                {...props}
                                fill={isHovered ? '#383838' : '#2c2c2c'}
                                onMouseEnter={() => setHoveredSegment({ barIndex, segmentKey })}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={{ cursor: 'pointer', transition: 'fill 0.2s ease' }}
                              />
                            );
                          }}
                        />
                        <Bar
                          dataKey={activeView === 'financial' ? 'Per-Session Cost' : 'Time to Hire'}
                          stackId="a"
                          maxBarSize={90}
                          fill="#69b7ff"
                          name={activeView === 'financial' ? 'Per-Session Cost' : 'Time to Hire'}
                          shape={(props: any) => {
                            const segmentKey = activeView === 'financial' ? 'Per-Session Cost' : 'Time to Hire';
                            const barIndex = chartData.findIndex((d: any) => d.name === props.payload?.name);
                            const isHovered = hoveredSegment?.barIndex === barIndex && hoveredSegment?.segmentKey === segmentKey;
                            return (
                              <rect
                                {...props}
                                fill={isHovered ? '#7bc0ff' : '#69b7ff'}
                                onMouseEnter={() => setHoveredSegment({ barIndex, segmentKey })}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={{ cursor: 'pointer', transition: 'fill 0.2s ease' }}
                              />
                            );
                          }}
                        />
                        {activeView === 'financial' && (
                          <Bar
                            dataKey="Running Cost"
                            stackId="a"
                            maxBarSize={90}
                            fill="#d3b3e5"
                            name="Running Cost"
                            shape={(props: any) => {
                              const segmentKey = 'Running Cost';
                              const barIndex = chartData.findIndex((d: any) => d.name === props.payload?.name);
                              const isHovered = hoveredSegment?.barIndex === barIndex && hoveredSegment?.segmentKey === segmentKey;
                              return (
                                <rect
                                  {...props}
                                  fill={isHovered ? '#ddc0ed' : '#d3b3e5'}
                                  onMouseEnter={() => setHoveredSegment({ barIndex, segmentKey })}
                                  onMouseLeave={() => setHoveredSegment(null)}
                                  style={{ cursor: 'pointer', transition: 'fill 0.2s ease' }}
                                />
                              );
                            }}
                          />
                        )}
                        <Bar
                          dataKey="Savings"
                          stackId="a"
                          maxBarSize={90}
                          fill={colors.success.main}
                          name="Savings"
                          shape={(props: any) => {
                            const segmentKey = 'Savings';
                            const barIndex = chartData.findIndex((d: any) => d.name === props.payload?.name);
                            const isHovered = hoveredSegment?.barIndex === barIndex && hoveredSegment?.segmentKey === segmentKey;
                            return (
                              <rect
                                {...props}
                                fill={isHovered ? '#65d42a' : colors.success.main}
                                onMouseEnter={() => setHoveredSegment({ barIndex, segmentKey })}
                                onMouseLeave={() => setHoveredSegment(null)}
                                style={{ cursor: 'pointer', transition: 'fill 0.2s ease' }}
                              />
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Space>
            </Col>
          </Row>
        </motion.div>
      </div>
    </div>
  );
};

export default CostCalculatorSection;

