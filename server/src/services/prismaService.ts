import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { UserType } from '@prisma/client';

export class PrismaService {
    private static instance: PrismaService;

    private constructor() {}

    public static getInstance(): PrismaService {
        if (!PrismaService.instance) {
            PrismaService.instance = new PrismaService();
        }
        return PrismaService.instance;
    }

    // User management methods
    public async createUser(userData: {
        email: string;
        passwordHash: string;
        fullName: string;
        userType: UserType;
        phone?: string;
        company?: string;
    }) {
        return await prisma.user.create({
            data: {
                email: userData.email,
                password_hash: userData.passwordHash,
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
        expiryDate?: string;
        maxAttempts?: number;
    }) {
        const updateData: any = {};
        
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
        if (updates.expiryDate !== undefined) updateData.expiry_date = updates.expiryDate ? new Date(updates.expiryDate) : null;
        if (updates.maxAttempts !== undefined) updateData.max_attempts = updates.maxAttempts;

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
                cheating_incidents: interview.cheating_incidents,
                security_agent_connected: interview.security_agent_connected,
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

    // Interviewer management methods
    public async createInterviewer(interviewerData: {
        email: string;
        passwordHash: string;
        fullName: string;
        phone?: string;
        company?: string;
    }) {
        return await prisma.interviewer.create({
            data: {
                email: interviewerData.email,
                password_hash: interviewerData.passwordHash,
                full_name: interviewerData.fullName,
                phone: interviewerData.phone,
                company: interviewerData.company,
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
    }) {
        console.log('=== PRISMA SAVE FINAL EVALUATION DEBUG ===');
        console.log('Session ID:', payload.sessionId);
        console.log('Candidate ID:', payload.candidateId);
        console.log('Interview Link ID:', payload.interviewLinkId);

        // Find the interview by session_id
        const interview = await prisma.interview.findUnique({
            where: { session_id: payload.sessionId },
        });

        if (!interview) {
            console.error('❌ Interview not found for session ID:', payload.sessionId);
            console.error('❌ Searching for similar session IDs...');
            const similarInterviews = await prisma.interview.findMany({
                where: { 
                    session_id: { contains: payload.sessionId.substring(0, 20) }
                },
                select: { id: true, session_id: true, candidate_name: true, created_at: true },
                take: 5
            });
            console.error('❌ Similar interviews found:', similarInterviews);
            throw new Error(`Interview not found for session ID: ${payload.sessionId}`);
        }
        
        console.log('✅ Interview found:', interview.id, 'Session:', interview.session_id);

        const data = {
            interview_id: interview.id,
            session_id: payload.sessionId,
            candidate_id: payload.candidateId,
            interview_link_id: payload.interviewLinkId || null,
            start_time: new Date(payload.startTime),
            end_time: new Date(payload.endTime),
            duration: payload.duration,
            full_conversation_history: JSON.stringify(payload.fullConversationHistory),
            theoretical_section: JSON.stringify(payload.theoreticalSection),
            coding_section: JSON.stringify(payload.codingSection),
            total_score: payload.totalScore,
            strengths: JSON.stringify(payload.strengths),
            areas_for_improvement: JSON.stringify(payload.areasForImprovement),
            overall_feedback: payload.overallFeedback,
            hint_request_count: payload.hintRequestCount,
            clarification_request_count: payload.clarificationRequestCount,
            follow_up_count: payload.followUpCount,
            average_time_per_question: payload.averageTimePerQuestion,
            average_time_per_coding_problem: payload.averageTimePerCodingProblem,
        };

        try {
            const result = await prisma.finalEvaluation.upsert({
                where: { interview_id: interview.id },
                update: data,
                create: data,
            });

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

    // Cleanup method
    public async disconnect() {
        await prisma.$disconnect();
    }
}
