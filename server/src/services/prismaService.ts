import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { UserType } from '@prisma/client';

export class PrismaService {
    private static instance: PrismaService;

    private constructor() { }

    public static getInstance(): PrismaService {
        if (!PrismaService.instance) {
            PrismaService.instance = new PrismaService();
        }
        return PrismaService.instance;
    }

    // User management methods
    public async createUser(userData: {
        email: string;
        fullName: string;
        userType: UserType;
        phone?: string;
        company?: string;
    }) {
        return await prisma.user.create({
            data: {
                email: userData.email,
                full_name: userData.fullName,
                user_type: userData.userType,
                phone: userData.phone,
                company: userData.company,
            },
        });
    }

    public async getUserByEmail(email: string) {
        return await prisma.user.findUnique({
            where: { email },
        });
    }

    public async getUserById(id: number) {
        return await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                full_name: true,
                user_type: true,
                phone: true,
                company: true,
                created_at: true,
                last_login: true,
                is_active: true,
            },
        });
    }

    public async updateUserLastLogin(userId: number) {
        return await prisma.user.update({
            where: { id: userId },
            data: { last_login: new Date() },
        });
    }

    public async getUserResume(userId: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { resume_data: true },
        });
        return user?.resume_data ? JSON.parse(user.resume_data) : null;
    }

    public async updateUserResume(userId: number, resumeData: any) {
        console.log('=== PRISMA UPDATE USER RESUME ===');
        console.log('User ID:', userId);
        console.log('Resume data keys:', Object.keys(resumeData || {}));

        const result = await prisma.user.update({
            where: { id: userId },
            data: { resume_data: JSON.stringify(resumeData) },
        });

        console.log('✅ User resume updated successfully');
        return result;
    }

    // Interview link management methods
    public async createInterviewLink(linkData: {
        createdBy: number;
        linkToken: string;
        title: string;
        description?: string;
        expiryDate?: string;
        maxAttempts?: number;
        // Additional metadata fields
        jobTitle?: string;
        jobId?: string;
        role?: string;
        yearsOfExperience?: number;
        maxInterviewQuestions?: number;
        maxMachineCodingQuestions?: number;
        topics?: string | any[];
        machineQuestions?: string | any[];
        questionSource?: 'auto' | 'manual';
    }) {
        return await prisma.interviewLink.create({
            data: {
                created_by: linkData.createdBy,
                link_token: linkData.linkToken,
                title: linkData.title,
                description: linkData.description,
                expiry_date: linkData.expiryDate ? new Date(linkData.expiryDate) : null,
                max_attempts: linkData.maxAttempts || 0,
                // Additional metadata fields
                job_title: linkData.jobTitle,
                job_id: linkData.jobId,
                role: linkData.role,
                years_of_experience: linkData.yearsOfExperience,
                max_interview_questions: linkData.maxInterviewQuestions,
                max_machine_coding_questions: linkData.maxMachineCodingQuestions,
                question_source: linkData.questionSource || 'auto',
                topics: Array.isArray(linkData.topics) ? JSON.stringify(linkData.topics) : linkData.topics,
                machine_questions: Array.isArray(linkData.machineQuestions) ? JSON.stringify(linkData.machineQuestions) : linkData.machineQuestions,
            },
        });
    }

    public async getInterviewLinkByToken(token: string) {
        return await prisma.interviewLink.findUnique({
            where: { link_token: token },
            include: {
                creator: {
                    select: {
                        full_name: true,
                        email: true,
                        company: true,
                        company_relation: {
                            select: {
                                name: true,
                                logo_url: true,
                            }
                        }
                    },
                },
            },
        });
    }

    public async getInterviewLinksByUser(userId: number) {
        const links = await prisma.interviewLink.findMany({
            where: { created_by: userId },
            orderBy: { created_at: 'desc' },
        });

        // Add total_attempts and completed_interviews for each link
        const linksWithStats = await Promise.all(
            links.map(async (link) => {
                const totalAttempts = await prisma.interview.count({
                    where: { interview_link_id: link.id },
                });
                const completedInterviews = await prisma.interview.count({
                    where: {
                        interview_link_id: link.id,
                        end_time: { not: null },
                    },
                });

                // Construct the interview link URL
                const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
                const url = `${baseUrl}/join?token=${link.link_token}`;

                return {
                    id: link.id,
                    token: link.link_token,
                    title: link.title,
                    description: link.description,
                    expiryDate: link.expiry_date,
                    maxAttempts: link.max_attempts,
                    isActive: link.is_active,
                    createdAt: link.created_at,
                    updatedAt: link.updated_at,
                    totalAttempts: totalAttempts,
                    completedInterviews: completedInterviews,
                    questionSource: link.question_source || 'auto',
                    url: url,
                };
            })
        );

        return linksWithStats;
    }

    public async updateInterviewLink(linkId: number, updates: {
        title?: string;
        description?: string;
        isActive?: boolean;
        expiryDate?: string | null;
        maxAttempts?: number;
        jobTitle?: string | null;
        jobId?: string | null;
        role?: string | null;
        yearsOfExperience?: number | null;
        maxInterviewQuestions?: number | null;
        maxMachineCodingQuestions?: number | null;
        topics?: string | any[] | null;
        machineQuestions?: string | any[] | null;
        questionSource?: 'auto' | 'manual';
    }) {
        const updateData: any = {};

        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
        if (updates.expiryDate !== undefined) {
            updateData.expiry_date = updates.expiryDate ? new Date(updates.expiryDate) : null;
        }
        if (updates.maxAttempts !== undefined) updateData.max_attempts = updates.maxAttempts;
        if (updates.jobTitle !== undefined) updateData.job_title = updates.jobTitle;
        if (updates.jobId !== undefined) updateData.job_id = updates.jobId;
        if (updates.role !== undefined) updateData.role = updates.role;
        if (updates.yearsOfExperience !== undefined) updateData.years_of_experience = updates.yearsOfExperience;
        if (updates.maxInterviewQuestions !== undefined) updateData.max_interview_questions = updates.maxInterviewQuestions;
        if (updates.maxMachineCodingQuestions !== undefined) updateData.max_machine_coding_questions = updates.maxMachineCodingQuestions;
        if (updates.questionSource !== undefined) updateData.question_source = updates.questionSource;

        if (updates.topics !== undefined) {
            if (updates.topics === null) {
                updateData.topics = null;
            } else {
                updateData.topics = Array.isArray(updates.topics) ? JSON.stringify(updates.topics) : updates.topics;
            }
        }

        if (updates.machineQuestions !== undefined) {
            if (updates.machineQuestions === null) {
                updateData.machine_questions = null;
            } else {
                updateData.machine_questions = Array.isArray(updates.machineQuestions)
                    ? JSON.stringify(updates.machineQuestions)
                    : updates.machineQuestions;
            }
        }

        return await prisma.interviewLink.update({
            where: { id: linkId },
            data: updateData,
        });
    }

    public async deleteInterviewLink(linkId: number) {
        return await prisma.interviewLink.delete({
            where: { id: linkId },
        });
    }

    public async getInterviewLinkById(linkId: number) {
        return await prisma.interviewLink.findUnique({
            where: { id: linkId },
            include: {
                creator: {
                    select: {
                        full_name: true,
                        email: true,
                    },
                },
            },
        });
    }

    public async getCandidatesByInterviewLink(linkId: number) {
        const interviews = await prisma.interview.findMany({
            where: { interview_link_id: linkId },
            include: {
                user: {
                    select: {
                        full_name: true,
                        email: true,
                    },
                },
                final_evaluation: true,
            },
            orderBy: { created_at: 'desc' },
        });

        // Parse JSON fields and include finalEvaluation
        return interviews.map(interview => {
            const finalEvaluation = interview.final_evaluation
                ? {
                    id: interview.final_evaluation.id,
                    sessionId: interview.final_evaluation.session_id,
                    candidateId: interview.final_evaluation.candidate_id,
                    interviewLinkId: interview.final_evaluation.interview_link_id,
                    startTime: interview.final_evaluation.start_time,
                    endTime: interview.final_evaluation.end_time,
                    duration: interview.final_evaluation.duration,
                    totalScore: interview.final_evaluation.total_score,
                    strengths: JSON.parse(interview.final_evaluation.strengths),
                    areasForImprovement: JSON.parse(interview.final_evaluation.areas_for_improvement),
                    overallFeedback: interview.final_evaluation.overall_feedback,
                    hintRequestCount: interview.final_evaluation.hint_request_count,
                    clarificationRequestCount: interview.final_evaluation.clarification_request_count,
                    followUpCount: interview.final_evaluation.follow_up_count,
                    averageTimePerQuestion: interview.final_evaluation.average_time_per_question,
                    averageTimePerCodingProblem: interview.final_evaluation.average_time_per_coding_problem,
                    fullConversationHistory: JSON.parse(interview.final_evaluation.full_conversation_history),
                    theoreticalSection: JSON.parse(interview.final_evaluation.theoretical_section),
                    codingSection: JSON.parse(interview.final_evaluation.coding_section),
                    llmEvaluation: interview.final_evaluation.llm_evaluation
                        ? JSON.parse(interview.final_evaluation.llm_evaluation)
                        : null,
                    createdAt: interview.final_evaluation.created_at,
                    updatedAt: interview.final_evaluation.updated_at,
                }
                : null;

            return {
                ...interview,
                strengths: interview.strengths ? JSON.parse(interview.strengths) : [],
                areasForImprovement: interview.areas_for_improvement ? JSON.parse(interview.areas_for_improvement) : [],
                detailed_answers: interview.detailed_answers ? JSON.parse(interview.detailed_answers) : [],
                question_analysis: interview.question_analysis ? JSON.parse(interview.question_analysis) : [],
                finalEvaluation,
            };
        });
    }

    // Interview management methods
    public async saveInterviewSummary(summary: any) {
        console.log('=== PRISMA SERVICE DEBUG ===');
        console.log('saveInterviewSummary called');

        const data = {
            session_id: summary.sessionId,
            user_id: summary.userId || null,
            interview_link_id: summary.interviewLinkId || null,
            candidate_name: summary.candidateName || 'Unknown',
            candidate_email: summary.candidateEmail || 'unknown@example.com',
            candidate_phone: summary.candidatePhone || '',
            start_time: new Date(summary.startTime),
            end_time: summary.endTime ? new Date(summary.endTime) : null,
            duration: summary.duration,
            score: summary.score,
            total_questions: summary.totalQuestions,
            correct_answers: summary.correctAnswers,
            time_spent: summary.timeSpent,
            strengths: JSON.stringify(summary.strengths),
            areas_for_improvement: JSON.stringify(summary.areasForImprovement),
            overall_feedback: summary.overallFeedback,
            detailed_answers: JSON.stringify(summary.detailed_answers),
            question_analysis: JSON.stringify(summary.question_analysis),
            is_mock_interview: summary.isMockInterview || false,
            cheating_detected: summary.cheatingDetected || false,
            cheating_incidents: JSON.stringify(summary.cheatingIncidents || []),
            security_agent_connected: summary.securityAgentConnected || false,
        };

        const result = await prisma.interview.upsert({
            where: { session_id: summary.sessionId },
            update: data,
            create: data,
        });

        console.log(`✅ Interview summary saved for session ${summary.sessionId}`);
        console.log('=== END PRISMA SERVICE DEBUG ===');
        return result;
    }

    public async getInterviewsByInterviewer(interviewerId: number) {
        const interviews = await prisma.interview.findMany({
            where: {
                OR: [
                    { interview_link: { created_by: interviewerId } },
                    { interview_link_id: null },
                ],
            },
            include: {
                final_evaluation: true,
                security_events: {
                    orderBy: { created_at: 'desc' }
                }
            },
            orderBy: { created_at: 'desc' },
        });

        // Parse JSON fields and include finalEvaluation
        return interviews.map(interview => {
            const finalEvaluation = interview.final_evaluation
                ? {
                    id: interview.final_evaluation.id,
                    sessionId: interview.final_evaluation.session_id,
                    candidateId: interview.final_evaluation.candidate_id,
                    interviewLinkId: interview.final_evaluation.interview_link_id,
                    startTime: interview.final_evaluation.start_time,
                    endTime: interview.final_evaluation.end_time,
                    duration: interview.final_evaluation.duration,
                    totalScore: interview.final_evaluation.total_score,
                    strengths: JSON.parse(interview.final_evaluation.strengths),
                    areasForImprovement: JSON.parse(interview.final_evaluation.areas_for_improvement),
                    overallFeedback: interview.final_evaluation.overall_feedback,
                    hintRequestCount: interview.final_evaluation.hint_request_count,
                    clarificationRequestCount: interview.final_evaluation.clarification_request_count,
                    followUpCount: interview.final_evaluation.follow_up_count,
                    averageTimePerQuestion: interview.final_evaluation.average_time_per_question,
                    averageTimePerCodingProblem: interview.final_evaluation.average_time_per_coding_problem,
                    fullConversationHistory: JSON.parse(interview.final_evaluation.full_conversation_history),
                    theoreticalSection: JSON.parse(interview.final_evaluation.theoretical_section),
                    codingSection: JSON.parse(interview.final_evaluation.coding_section),
                    llmEvaluation: interview.final_evaluation.llm_evaluation
                        ? JSON.parse(interview.final_evaluation.llm_evaluation)
                        : null,
                    createdAt: interview.final_evaluation.created_at,
                    updatedAt: interview.final_evaluation.updated_at,
                }
                : null;

            return {
                id: interview.id,
                session_id: interview.session_id,
                candidate_name: interview.candidate_name,
                candidate_email: interview.candidate_email,
                candidate_phone: interview.candidate_phone,
                start_time: interview.start_time,
                end_time: interview.end_time,
                duration: interview.duration,
                score: interview.score,
                total_questions: interview.total_questions,
                correct_answers: interview.correct_answers,
                time_spent: interview.time_spent,
                strengths: interview.strengths ? JSON.parse(interview.strengths) : [],
                areasForImprovement: interview.areas_for_improvement ? JSON.parse(interview.areas_for_improvement) : [],
                overall_feedback: interview.overall_feedback,
                detailed_answers: interview.detailed_answers ? JSON.parse(interview.detailed_answers) : [],
                question_analysis: interview.question_analysis ? JSON.parse(interview.question_analysis) : [],
                created_at: interview.created_at,
                updated_at: interview.updated_at,
                cheating_detected: interview.cheating_detected,
                cheating_incidents: interview.cheating_incidents ? JSON.parse(interview.cheating_incidents) : [],
                security_agent_connected: interview.security_agent_connected,
                security_events: interview.security_events ? interview.security_events.map((e: any) => ({
                    id: e.id,
                    event_type: e.event_type,
                    source: e.source,
                    severity: e.severity,
                    message: e.message,
                    metadata: e.metadata ? JSON.parse(e.metadata) : null,
                    created_at: e.created_at
                })) : [],
                finalEvaluation,
            };
        });
    }

    public async getInterviewsByCandidate(candidateEmail: string) {
        console.log('=== PRISMA SERVICE DEBUG ===');
        console.log('Querying interviews for candidate email:', candidateEmail);

        const interviews = await prisma.interview.findMany({
            where: { candidate_email: candidateEmail },
            include: {
                interview_link: {
                    select: {
                        title: true,
                        description: true,
                        creator: {
                            select: {
                                company: true,
                                company_relation: {
                                    select: {
                                        id: true,
                                        name: true,
                                        logo_url: true,
                                    }
                                }
                            }
                        }
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        console.log('Database returned', interviews.length, 'rows');

        // Parse JSON fields
        const parsedInterviews = interviews.map(interview => ({
            id: interview.id,
            session_id: interview.session_id,
            candidate_name: interview.candidate_name,
            candidate_email: interview.candidate_email,
            candidate_phone: interview.candidate_phone,
            start_time: interview.start_time,
            end_time: interview.end_time,
            duration: interview.duration,
            score: interview.score,
            total_questions: interview.total_questions,
            correct_answers: interview.correct_answers,
            time_spent: interview.time_spent,
            strengths: interview.strengths ? JSON.parse(interview.strengths) : [],
            areasForImprovement: interview.areas_for_improvement ? JSON.parse(interview.areas_for_improvement) : [],
            overall_feedback: interview.overall_feedback,
            detailed_answers: interview.detailed_answers ? JSON.parse(interview.detailed_answers) : [],
            question_analysis: interview.question_analysis ? JSON.parse(interview.question_analysis) : [],
            created_at: interview.created_at,
            updated_at: interview.updated_at,
            title: interview.interview_link?.title,
            description: interview.interview_link?.description,
            company: interview.interview_link?.creator?.company_relation?.name || interview.interview_link?.creator?.company,
            companyId: interview.interview_link?.creator?.company_relation?.id,
            companyLogo: interview.interview_link?.creator?.company_relation?.logo_url,
            interview_link_id: interview.interview_link_id,
        }));

        console.log('Parsed interviews count:', parsedInterviews.length);
        console.log('=== END PRISMA SERVICE DEBUG ===');

        return parsedInterviews;
    }

    public async getInterviewById(id: number) {
        const interview = await prisma.interview.findUnique({
            where: { id },
            include: {
                final_evaluation: true,
                security_events: {
                    orderBy: { created_at: 'desc' }
                },
                candidate_feedback: true
            },
        });

        if (!interview) return null;

        // Parse JSON fields
        const finalEvaluation = interview.final_evaluation
            ? {
                id: interview.final_evaluation.id,
                sessionId: interview.final_evaluation.session_id,
                candidateId: interview.final_evaluation.candidate_id,
                interviewLinkId: interview.final_evaluation.interview_link_id,
                startTime: interview.final_evaluation.start_time,
                endTime: interview.final_evaluation.end_time,
                duration: interview.final_evaluation.duration,
                totalScore: interview.final_evaluation.total_score,
                strengths: JSON.parse(interview.final_evaluation.strengths),
                areasForImprovement: JSON.parse(interview.final_evaluation.areas_for_improvement),
                overallFeedback: interview.final_evaluation.overall_feedback,
                hintRequestCount: interview.final_evaluation.hint_request_count,
                clarificationRequestCount: interview.final_evaluation.clarification_request_count,
                followUpCount: interview.final_evaluation.follow_up_count,
                averageTimePerQuestion: interview.final_evaluation.average_time_per_question,
                averageTimePerCodingProblem: interview.final_evaluation.average_time_per_coding_problem,
                fullConversationHistory: JSON.parse(interview.final_evaluation.full_conversation_history),
                theoreticalSection: JSON.parse(interview.final_evaluation.theoretical_section),
                codingSection: JSON.parse(interview.final_evaluation.coding_section),
                llmEvaluation: interview.final_evaluation.llm_evaluation
                    ? JSON.parse(interview.final_evaluation.llm_evaluation)
                    : null,
                createdAt: interview.final_evaluation.created_at,
                updatedAt: interview.final_evaluation.updated_at,
            }
            : null;

        return {
            id: interview.id,
            session_id: interview.session_id,
            candidate_name: interview.candidate_name,
            candidate_email: interview.candidate_email,
            candidate_phone: interview.candidate_phone,
            start_time: interview.start_time,
            end_time: interview.end_time,
            duration: interview.duration,
            score: interview.score,
            total_questions: interview.total_questions,
            correct_answers: interview.correct_answers,
            time_spent: interview.time_spent,
            strengths: interview.strengths ? JSON.parse(interview.strengths) : [],
            areasForImprovement: interview.areas_for_improvement ? JSON.parse(interview.areas_for_improvement) : [],
            overall_feedback: interview.overall_feedback,
            detailed_answers: interview.detailed_answers ? JSON.parse(interview.detailed_answers) : [],
            question_analysis: interview.question_analysis ? JSON.parse(interview.question_analysis) : [],
            cheating_detected: interview.cheating_detected,
            cheating_incidents: interview.cheating_incidents ? JSON.parse(interview.cheating_incidents) : [],
            security_agent_connected: interview.security_agent_connected,
            security_events: interview.security_events ? interview.security_events.map((e: any) => ({
                id: e.id,
                event_type: e.event_type,
                source: e.source,
                severity: e.severity,
                message: e.message,
                metadata: e.metadata ? JSON.parse(e.metadata) : null,
                created_at: e.created_at
            })) : [],
            candidate_feedback: interview.candidate_feedback ? {
                id: interview.candidate_feedback.id,
                rating: interview.candidate_feedback.rating,
                overall_experience: interview.candidate_feedback.overall_experience,
                technical_questions_quality: interview.candidate_feedback.technical_questions_quality,
                interview_platform_rating: interview.candidate_feedback.interview_platform_rating,
                suggestions: interview.candidate_feedback.suggestions,
                would_recommend: interview.candidate_feedback.would_recommend,
                created_at: interview.candidate_feedback.created_at,
                updated_at: interview.candidate_feedback.updated_at
            } : null,
            created_at: interview.created_at,
            updated_at: interview.updated_at,
            finalEvaluation,
        };
    }

    public async verifyInterviewerAccess(interviewId: number, interviewerId: number) {
        const interview = await prisma.interview.findFirst({
            where: {
                id: interviewId,
                OR: [
                    { interview_link: { created_by: interviewerId } },
                    { interview_link_id: null },
                ],
            },
        });

        return interview !== null;
    }

    public async updateCheatingDetection(sessionId: string, data: {
        cheatingDetected: boolean;
        cheatingIncidents: any[];
        securityAgentConnected: boolean;
    }) {
        console.log('=== UPDATE CHEATING DETECTION ===');
        console.log('Session ID:', sessionId);
        console.log('Cheating detected:', data.cheatingDetected);
        console.log('Incidents count:', data.cheatingIncidents.length);
        console.log('Security agent connected:', data.securityAgentConnected);

        // Get interview to find interview_id and interview_link_id
        const interview = await prisma.interview.findUnique({
            where: { session_id: sessionId },
            select: { id: true, interview_link_id: true }
        });

        // Create security events for each cheating incident
        if (data.cheatingIncidents && data.cheatingIncidents.length > 0) {
            for (const incident of data.cheatingIncidents) {
                await prisma.securityEvent.create({
                    data: {
                        interview_id: interview?.id,
                        interview_link_id: interview?.interview_link_id || null,
                        session_id: sessionId,
                        event_type: 'app_blocked',
                        source: 'desktop_security_agent',
                        severity: 'high',
                        message: `Blocked application: ${incident.processName} (${incident.reason})`,
                        metadata: JSON.stringify(incident)
                    }
                });
            }
        }

        const result = await prisma.interview.update({
            where: { session_id: sessionId },
            data: {
                cheating_detected: data.cheatingDetected,
                cheating_incidents: JSON.stringify(data.cheatingIncidents),
                security_agent_connected: data.securityAgentConnected,
            },
        });

        console.log(`✅ Cheating detection updated for session ${sessionId}`);
        return result;
    }

    /**
     * Create a security event (for vision security or other sources)
     * Prevents duplicates by checking if the same event already exists
     */
    public async createSecurityEvent(sessionId: string, data: {
        eventType: string;
        source: string;
        severity: 'low' | 'medium' | 'high';
        message: string;
        metadata?: any;
    }) {
        // Get interview to find interview_id and interview_link_id
        const interview = await prisma.interview.findUnique({
            where: { session_id: sessionId },
            select: { id: true, interview_link_id: true }
        });

        if (!interview) {
            console.warn(`⚠️ Interview not found for session ${sessionId}, cannot create security event`);
            return null;
        }

        // Check for duplicate events (same type, source, and similar timestamp within 1 second)
        // This prevents duplicate entries from multiple API calls
        const metadataStr = data.metadata ? JSON.stringify(data.metadata) : null
        const oneSecondAgo = new Date(Date.now() - 1000)

        const existingEvent = await prisma.securityEvent.findFirst({
            where: {
                interview_id: interview.id,
                session_id: sessionId,
                event_type: data.eventType,
                source: data.source,
                severity: data.severity,
                created_at: {
                    gte: oneSecondAgo
                }
            }
        })

        if (existingEvent) {
            console.log(`⚠️ Duplicate security event detected and skipped: ${data.eventType} from ${data.source}`)
            return existingEvent
        }

        return await prisma.securityEvent.create({
            data: {
                interview_id: interview.id,
                interview_link_id: interview.interview_link_id || null,
                session_id: sessionId,
                event_type: data.eventType,
                source: data.source,
                severity: data.severity,
                message: data.message,
                metadata: metadataStr
            }
        });
    }

    /**
     * Get security events for an interview
     */
    public async getSecurityEvents(interviewId: number) {
        return await prisma.securityEvent.findMany({
            where: { interview_id: interviewId },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * Get security events by session ID
     */
    public async getSecurityEventsBySession(sessionId: string) {
        return await prisma.securityEvent.findMany({
            where: { session_id: sessionId },
            orderBy: { created_at: 'desc' }
        });
    }

    // Interviewer management methods
    public async createInterviewer(interviewerData: {
        email: string;
        fullName: string;
        phone?: string;
        company?: string;
        jobRole?: string;
        companyId?: number;
    }) {
        return await prisma.interviewer.create({
            data: {
                email: interviewerData.email,
                full_name: interviewerData.fullName,
                phone: interviewerData.phone,
                company: interviewerData.company,
                job_role: interviewerData.jobRole,
                company_id: interviewerData.companyId,
            },
        });
    }

    public async getInterviewerByEmail(email: string) {
        return await prisma.interviewer.findUnique({
            where: { email },
        });
    }

    public async getInterviewerById(id: number) {
        return await prisma.interviewer.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                full_name: true,
                phone: true,
                company: true,
                job_role: true,
                created_at: true,
                last_login: true,
                is_active: true,
            },
        });
    }

    public async updateInterviewerLastLogin(interviewerId: number) {
        return await prisma.interviewer.update({
            where: { id: interviewerId },
            data: { last_login: new Date() },
        });
    }

    public async updateInterviewerProfile(interviewerId: number, data: {
        company: string;
        jobRole: string;
    }) {
        return await prisma.interviewer.update({
            where: { id: interviewerId },
            data: {
                company: data.company,
                job_role: data.jobRole,
            },
        });
    }

    // Company management methods
    public async createCompany(name: string, logoUrl?: string, website?: string) {
        return await prisma.company.create({
            data: {
                name,
                logo_url: logoUrl,
                website,
            },
        });
    }

    public async getCompanyByName(name: string) {
        return await prisma.company.findUnique({
            where: { name },
        });
    }

    public async getCompanyById(id: number) {
        return await prisma.company.findUnique({
            where: { id },
            include: {
                members: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                    }
                }
            }
        });
    }

    // Interview link methods for question generation

    public async updateInterviewLinkQuestions(linkId: number, questions: any[]) {
        return await prisma.interviewLink.update({
            where: { id: linkId },
            data: {
                generated_questions: JSON.stringify(questions),
                questions_approved: true,
            },
        });
    }

    // Final Evaluation methods
    public async saveFinalEvaluation(payload: {
        sessionId: string;
        candidateId: string;
        interviewLinkId?: number;
        startTime: string;
        endTime: string;
        duration: number;
        fullConversationHistory: any[];
        theoreticalSection: any;
        codingSection: any;
        totalScore: number;
        strengths: string[];
        areasForImprovement: string[];
        overallFeedback: string;
        hintRequestCount: number;
        clarificationRequestCount: number;
        followUpCount: number;
        averageTimePerQuestion: number;
        averageTimePerCodingProblem: number;
        visionSecurityWarnings?: any;
    }) {
        console.log('\n=== PRISMA SAVE FINAL EVALUATION DEBUG ===');
        console.log('Session ID:', payload.sessionId);
        console.log('Candidate ID:', payload.candidateId);
        console.log('Interview Link ID:', payload.interviewLinkId);
        console.log('Vision Security Warnings:', payload.visionSecurityWarnings ? 'YES' : 'NO');
        if (payload.visionSecurityWarnings) {
            console.log('Warning types:', Object.keys(payload.visionSecurityWarnings));
        }

        // Find or create the interview by session_id
        let interview = await prisma.interview.findUnique({
            where: { session_id: payload.sessionId },
        });

        if (!interview) {
            console.log('⚠️ Interview not found for session ID:', payload.sessionId, '- creating new interview record');
            // Create interview record from final evaluation data
            interview = await prisma.interview.create({
                data: {
                    session_id: payload.sessionId,
                    interview_link_id: payload.interviewLinkId || null,
                    candidate_name: payload.candidateId,
                    candidate_email: payload.candidateId,
                    start_time: new Date(payload.startTime),
                    end_time: new Date(payload.endTime),
                    duration: payload.duration,
                    score: Math.round(payload.totalScore),
                    total_questions: (payload.theoreticalSection?.totalQuestions || 0) + (payload.codingSection?.totalProblems || 0),
                    correct_answers: 0,
                    time_spent: payload.duration,
                    strengths: JSON.stringify(payload.strengths),
                    areas_for_improvement: JSON.stringify(payload.areasForImprovement),
                    overall_feedback: payload.overallFeedback,
                    detailed_answers: JSON.stringify([]),
                    question_analysis: JSON.stringify({}),
                    cheating_detected: false,
                    cheating_incidents: JSON.stringify([]),
                    security_agent_connected: false
                }
            });
            console.log('✅ Interview record created:', interview.id);
        } else {
            console.log('✅ Interview found:', interview.id, 'Session:', interview.session_id);
            // Updating the parent Interview table with final stats is crucial for the dashboard
            await prisma.interview.update({
                where: { id: interview.id },
                data: {
                    duration: payload.duration,
                    time_spent: payload.duration,
                    score: Math.round(payload.totalScore),
                    end_time: new Date(payload.endTime),
                    // Also ensure candidate info is up to date if provided
                    candidate_name: payload.candidateId,
                    candidate_email: payload.candidateId,
                    total_questions: (payload.theoreticalSection?.totalQuestions || 0) + (payload.codingSection?.totalProblems || 0),
                }
            });
            console.log('✅ Synced final stats to Interview table for interview:', interview.id);
        }

        // Normalize / provide safe defaults so Prisma doesn't receive undefined for required fields
        // Separate update and create data to handle Prisma relations properly
        const baseData = {
            session_id: payload.sessionId,
            candidate_id: payload.candidateId || '',
            interview_link_id: payload.interviewLinkId ?? null,
            start_time: new Date(payload.startTime),
            end_time: new Date(payload.endTime),
            duration: payload.duration ?? 0,
            full_conversation_history: JSON.stringify(payload.fullConversationHistory ?? []),
            theoretical_section: JSON.stringify(payload.theoreticalSection ?? {}),
            coding_section: JSON.stringify(payload.codingSection ?? {}),
            total_score: payload.totalScore ?? 0,
            strengths: JSON.stringify(payload.strengths ?? []),
            areas_for_improvement: JSON.stringify(payload.areasForImprovement ?? []),
            overall_feedback: payload.overallFeedback ?? '',
            hint_request_count: payload.hintRequestCount ?? 0,
            clarification_request_count: payload.clarificationRequestCount ?? 0,
            follow_up_count: payload.followUpCount ?? 0,
            average_time_per_question: payload.averageTimePerQuestion ?? null,
            average_time_per_coding_problem: payload.averageTimePerCodingProblem ?? null,
        };

        // For create, use the connect syntax for the relation
        const createData = {
            ...baseData,
            interview: { connect: { id: interview.id } },
        };

        // For update, don't include interview_id as it's the unique constraint field
        const updateData = baseData;

        try {
            const result = await prisma.finalEvaluation.upsert({
                where: { interview_id: interview.id },
                update: updateData,
                create: createData,
            });

            // Save vision security warnings to SecurityEvent table if provided
            if (payload.visionSecurityWarnings && Object.keys(payload.visionSecurityWarnings).length > 0) {
                try {
                    // Log summary without full screenshot data (which can be megabytes)
                    const warningSummary = Object.entries(payload.visionSecurityWarnings).map(([type, data]: [string, any]) => ({
                        type,
                        count: data?.count || 0,
                        totalDuration: data?.totalDuration || 0,
                        eventsCount: data?.events?.length || 0,
                        hasScreenshot: !!data?.screenshot,
                        screenshotLength: data?.screenshot?.length || 0
                    }));
                    console.log('📊 [Security Events] Processing vision security warnings:', JSON.stringify(warningSummary, null, 2));

                    const incidents = Object.entries(payload.visionSecurityWarnings).flatMap(([type, data]: [string, any]) => {
                        if (!data || !data.events || !Array.isArray(data.events)) {
                            console.warn(`⚠️ [Security Events] Invalid data structure for type ${type}:`, data);
                            return [];
                        }
                        // For multiple_faces, include screenshot if available (only 1 screenshot total)
                        const screenshot = type === 'multiple_faces' && data.screenshot ? data.screenshot : null;

                        if (screenshot) {
                            console.log(`📸 [Security Events] Screenshot found for ${type}, length: ${screenshot.length} chars`);
                        } else {
                            console.log(`📸 [Security Events] No screenshot for ${type}`);
                        }

                        // If we have a screenshot but no events, create a placeholder event to store the screenshot
                        if (type === 'multiple_faces' && screenshot && data.events.length === 0) {
                            console.log(`📸 [Security Events] Creating placeholder event for multiple_faces to store screenshot`);
                            return [{
                                interview_id: interview.id,
                                interview_link_id: interview.interview_link_id || null,
                                session_id: payload.sessionId,
                                event_type: type,
                                source: 'vision_security',
                                severity: 'medium' as const,
                                message: 'Multiple faces detected',
                                metadata: JSON.stringify({ screenshot: screenshot })
                            }];
                        }

                        return data.events.map((event: any, index: number) => {
                            const metadata: any = {
                                duration: event.duration,
                                startTime: event.startTime,
                                endTime: event.endTime
                            };
                            // Include screenshot ONLY in the FIRST event for multiple_faces
                            // All other events will reference this first event
                            if (screenshot && index === 0) {
                                metadata.screenshot = screenshot; // base64 string
                                console.log(`📸 [Security Events] Adding screenshot to FIRST event only for ${type}`);
                            }

                            return {
                                interview_id: interview.id,
                                interview_link_id: interview.interview_link_id || null,
                                session_id: payload.sessionId,
                                event_type: type,
                                source: 'vision_security',
                                severity: 'medium' as const,
                                message: `${type.replace(/_/g, ' ')} detected for ${Math.round(event.duration / 1000)}s`,
                                metadata: JSON.stringify(metadata)
                            };
                        });
                    });

                    console.log(`📊 [Security Events] Prepared ${incidents.length} incidents to save`);

                    if (incidents.length > 0) {
                        // Check for existing events to avoid duplicates
                        const existing = await prisma.securityEvent.findMany({
                            where: {
                                interview_id: interview.id,
                                source: 'vision_security'
                            },
                            select: { event_type: true, metadata: true }
                        });

                        const existingKeys = new Set(
                            existing.map(e => {
                                const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
                                return `${e.event_type}-${meta.startTime}-${meta.endTime}`;
                            })
                        );

                        const newIncidents = incidents.filter(inc => {
                            const meta = typeof inc.metadata === 'string' ? JSON.parse(inc.metadata) : inc.metadata;
                            const key = `${inc.event_type}-${meta.startTime}-${meta.endTime}`;
                            return !existingKeys.has(key);
                        });

                        console.log(`📊 [Security Events] Filtered ${incidents.length} -> ${newIncidents.length} (removed ${incidents.length - newIncidents.length} duplicates)`);

                        if (newIncidents.length > 0) {
                            await prisma.securityEvent.createMany({ data: newIncidents });
                            console.log(`✅ Vision security warnings saved: ${newIncidents.length} new incidents`);
                        }

                        if (incidents.length > 0) {
                            await prisma.interview.update({
                                where: { id: interview.id },
                                data: { cheating_detected: true }
                            });
                        }
                    } else {
                        console.warn('⚠️ [Security Events] No valid incidents to save after processing');
                    }
                } catch (securityError: any) {
                    console.error('❌ [Security Events] Error saving vision security warnings:');
                    console.error('❌ Error message:', securityError.message);
                    console.error('❌ Error stack:', securityError.stack);
                    console.error('❌ Error code:', securityError.code);
                    // Don't throw - allow final evaluation to be saved even if security events fail
                }
            } else {
                console.log('📊 [Security Events] No vision security warnings provided in payload');
            }

            console.log(`✅ Final evaluation saved for interview ${interview.id}`);
            console.log(`✅ Final evaluation ID: ${result.id}`);
            console.log(`✅ Full conversation history saved: ${payload.fullConversationHistory.length} messages`);
            console.log(`✅ Theoretical conversations: ${payload.theoreticalSection?.conversations?.length || 0}`);
            console.log(`✅ Coding conversations: ${payload.codingSection?.conversations?.length || 0}`);
            console.log('=== END PRISMA SAVE FINAL EVALUATION DEBUG ===');
            return result;
        } catch (dbError: any) {
            console.error('❌ Database error saving final evaluation:');
            console.error('❌ Error code:', dbError.code);
            console.error('❌ Error message:', dbError.message);
            console.error('❌ Error meta:', JSON.stringify(dbError.meta, null, 2));
            throw dbError;
        }
    }

    public async updateLLMEvaluation(interviewId: number, llmEvaluation: any) {
        try {
            const result = await prisma.finalEvaluation.update({
                where: { interview_id: interviewId },
                data: {
                    llm_evaluation: JSON.stringify(llmEvaluation),
                },
            });

            // Also update the interview.score field with the LLM evaluation overall score if available
            // This ensures the score is easily accessible for statistics
            if (llmEvaluation?.overall?.score !== null && llmEvaluation?.overall?.score !== undefined) {
                await prisma.interview.update({
                    where: { id: interviewId },
                    data: {
                        score: Math.round(llmEvaluation.overall.score),
                    },
                });
                console.log(`✅ Interview score updated to ${llmEvaluation.overall.score} for interview ${interviewId}`);
            }

            console.log(`✅ LLM evaluation saved for interview ${interviewId}`);
            return result;
        } catch (error) {
            console.error('❌ Error saving LLM evaluation:', error);
            throw error;
        }
    }

    public async getFinalEvaluationBySessionId(sessionId: string) {
        const interview = await prisma.interview.findUnique({
            where: { session_id: sessionId },
            include: { final_evaluation: true },
        });

        if (!interview || !interview.final_evaluation) {
            return null;
        }

        // Parse JSON fields
        return {
            id: interview.final_evaluation.id,
            interviewId: interview.final_evaluation.interview_id,
            sessionId: interview.final_evaluation.session_id,
            candidateId: interview.final_evaluation.candidate_id,
            interviewLinkId: interview.final_evaluation.interview_link_id,
            startTime: interview.final_evaluation.start_time,
            endTime: interview.final_evaluation.end_time,
            duration: interview.final_evaluation.duration,
            fullConversationHistory: JSON.parse(interview.final_evaluation.full_conversation_history),
            theoreticalSection: JSON.parse(interview.final_evaluation.theoretical_section),
            codingSection: JSON.parse(interview.final_evaluation.coding_section),
            totalScore: interview.final_evaluation.total_score,
            strengths: JSON.parse(interview.final_evaluation.strengths),
            areasForImprovement: JSON.parse(interview.final_evaluation.areas_for_improvement),
            overallFeedback: interview.final_evaluation.overall_feedback,
            hintRequestCount: interview.final_evaluation.hint_request_count,
            clarificationRequestCount: interview.final_evaluation.clarification_request_count,
            followUpCount: interview.final_evaluation.follow_up_count,
            averageTimePerQuestion: interview.final_evaluation.average_time_per_question,
            averageTimePerCodingProblem: interview.final_evaluation.average_time_per_coding_problem,
            createdAt: interview.final_evaluation.created_at,
            updatedAt: interview.final_evaluation.updated_at,
        };
    }

    // Candidate Feedback methods
    public async saveCandidateFeedback(data: {
        interviewId: number;
        sessionId: string;
        rating: number;
        overallExperience?: string;
        technicalQuestionsQuality?: string;
        interviewPlatformRating?: number;
        suggestions?: string;
        wouldRecommend?: boolean;
    }) {
        return await prisma.candidateFeedback.upsert({
            where: { interview_id: data.interviewId },
            update: {
                rating: data.rating,
                overall_experience: data.overallExperience,
                technical_questions_quality: data.technicalQuestionsQuality,
                interview_platform_rating: data.interviewPlatformRating,
                suggestions: data.suggestions,
                would_recommend: data.wouldRecommend,
            },
            create: {
                interview_id: data.interviewId,
                session_id: data.sessionId,
                rating: data.rating,
                overall_experience: data.overallExperience,
                technical_questions_quality: data.technicalQuestionsQuality,
                interview_platform_rating: data.interviewPlatformRating,
                suggestions: data.suggestions,
                would_recommend: data.wouldRecommend,
            },
        });
    }

    public async getCandidateFeedbackBySessionId(sessionId: string) {
        return await prisma.candidateFeedback.findFirst({
            where: { session_id: sessionId },
            include: {
                interview: {
                    select: {
                        id: true,
                        session_id: true,
                        candidate_name: true,
                        candidate_email: true,
                    }
                }
            }
        });
    }

    // Cleanup method
    public async disconnect() {
        await prisma.$disconnect();
    }
}
