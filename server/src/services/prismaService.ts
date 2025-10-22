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
        topics?: string;
        machineQuestions?: string;
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
                topics: linkData.topics,
                machine_questions: linkData.machineQuestions,
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

                return {
                    ...link,
                    total_attempts: totalAttempts,
                    completed_interviews: completedInterviews,
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
            },
            orderBy: { created_at: 'desc' },
        });

        // Parse JSON fields
        return interviews.map(interview => ({
            ...interview,
            strengths: interview.strengths ? JSON.parse(interview.strengths) : [],
            areasForImprovement: interview.areas_for_improvement ? JSON.parse(interview.areas_for_improvement) : [],
            detailed_answers: interview.detailed_answers ? JSON.parse(interview.detailed_answers) : [],
            question_analysis: interview.question_analysis ? JSON.parse(interview.question_analysis) : [],
        }));
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
            orderBy: { created_at: 'desc' },
        });

        // Parse JSON fields
        return interviews.map(interview => ({
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
        }));
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
        });

        if (!interview) return null;

        // Parse JSON fields
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

    // Admin management methods
    public async authenticateAdmin(username: string, password: string) {
        const admin = await prisma.adminUser.findUnique({
            where: { username },
        });

        if (!admin) {
            return false;
        }

        const isValid = bcrypt.compareSync(password, admin.password_hash);
        
        if (isValid) {
            // Update last login
            await prisma.adminUser.update({
                where: { username },
                data: { last_login: new Date() },
            });
        }

        return isValid;
    }

    public async createDefaultAdmin() {
        const adminCount = await prisma.adminUser.count();
        
        if (adminCount === 0) {
            const defaultPassword = 'admin123'; // Change this in production!
            const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

            await prisma.adminUser.create({
                data: {
                    username: 'admin',
                    password_hash: hashedPassword,
                },
            });

            console.log('Default admin user created: username=admin, password=admin123');
        }
    }

    // Cleanup method
    public async disconnect() {
        await prisma.$disconnect();
    }
}
