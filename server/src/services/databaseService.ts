import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

export class DatabaseService {
    private db: sqlite3.Database;
    private static instance: DatabaseService;

    private constructor() {
        // Create data directory if it doesn't exist
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const dbPath = path.join(dataDir, 'interviews.db');
        this.db = new sqlite3.Database(dbPath);
        this.initializeDatabase();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    private initializeDatabase(): void {
        // Create users table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        user_type TEXT NOT NULL CHECK(user_type IN ('candidate', 'interviewer')),
        phone TEXT,
        company TEXT,
        resume_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1
      )
    `, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            } else {
                console.log('Users table created successfully');
        
        // Add resume_data column if it doesn't exist (migration)
        this.db.run(`
            ALTER TABLE users ADD COLUMN resume_data TEXT
        `, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding resume_data column:', err);
            } else if (!err) {
                console.log('Resume_data column added successfully');
            }
        });
            }
        });

        // Create interview_links table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS interview_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_by INTEGER NOT NULL,
        link_token TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        expiry_date DATETIME,
        max_attempts INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `, (err) => {
            if (err) {
                console.error('Error creating interview_links table:', err);
            } else {
                console.log('Interview links table created successfully');
            }
        });

        // Sessions table removed - using interviews table for all data storage

        this.db.run(`
      CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        interview_link_id INTEGER,
        candidate_name TEXT NOT NULL,
        candidate_email TEXT NOT NULL,
        candidate_phone TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration INTEGER,
        score INTEGER,
        total_questions INTEGER,
        correct_answers INTEGER,
        time_spent INTEGER,
        strengths TEXT,
        areas_for_improvement TEXT,
        overall_feedback TEXT,
        detailed_answers TEXT,
        question_analysis TEXT,
        is_mock_interview BOOLEAN DEFAULT 0,
        cheating_detected BOOLEAN DEFAULT 0,
        cheating_incidents TEXT,
        security_agent_connected BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (interview_link_id) REFERENCES interview_links(id)
      )
    `, (err) => {
            if (err) {
                console.error('Error creating interviews table:', err);
            } else {
                console.log('Interviews table created successfully');
                // Add new columns for cheating detection if they don't exist
                this.addCheatingDetectionColumns();
            }
        });

        // Create admin_users table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `, (err) => {
            if (err) {
                console.error('Error creating admin_users table:', err);
            } else {
                console.log('Admin users table created successfully');
                // Create default admin user after table is created
                this.createDefaultAdmin();
            }
        });
    }

    private async createDefaultAdmin(): Promise<void> {
        const bcrypt = require('bcryptjs');

        this.db.get('SELECT COUNT(*) as count FROM admin_users', (err, row: any) => {
            if (err) {
                console.error('Error checking admin users:', err);
                return;
            }

            if (row.count === 0) {
                const defaultPassword = 'admin123'; // Change this in production!
                const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

                this.db.run(
                    'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
                    ['admin', hashedPassword],
                    (err) => {
                        if (err) {
                            console.error('Error creating default admin:', err);
                        } else {
                            console.log('Default admin user created: username=admin, password=admin123');
                        }
                    }
                );
            }
        });
    }

    public async saveInterviewSummary(summary: any): Promise<void> {
        return new Promise((resolve, reject) => {
            // DEBUG: Log database operation
            console.log('=== DATABASE SERVICE DEBUG ===');
            console.log('saveInterviewSummary called');

            const query = `
        INSERT OR REPLACE INTO interviews (
          session_id, user_id, interview_link_id, candidate_name, candidate_email, candidate_phone,
          start_time, end_time, duration, score, total_questions, correct_answers,
          time_spent, strengths, areas_for_improvement, overall_feedback,
          detailed_answers, question_analysis, is_mock_interview, 
          cheating_detected, cheating_incidents, security_agent_connected, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

            const values = [
                summary.sessionId,
                summary.userId || null,
                summary.interviewLinkId || null,
                summary.candidateName || 'Unknown',
                summary.candidateEmail || 'unknown@example.com',
                summary.candidatePhone || '',
                summary.startTime,
                summary.endTime,
                summary.duration,
                summary.score,
                summary.totalQuestions,
                summary.correctAnswers,
                summary.timeSpent,
                JSON.stringify(summary.strengths),
                JSON.stringify(summary.areasForImprovement),
                summary.overallFeedback,
                JSON.stringify(summary.detailedAnswers),
                JSON.stringify(summary.questionAnalysis),
                summary.isMockInterview ? 1 : 0,
                summary.cheatingDetected ? 1 : 0,
                JSON.stringify(summary.cheatingIncidents || []),
                summary.securityAgentConnected ? 1 : 0
            ];

            this.db.run(query, values, function (err) {
                if (err) {
                    console.error('❌ Database error saving interview summary:', err);
                    reject(err);
                } else {
                    console.log(`✅ Interview summary saved for session ${summary.sessionId}`);
                }
                console.log('=== END DATABASE SERVICE DEBUG ===');
                resolve();
            });
        });
    }

    public async getInterviewsByInterviewer(interviewerId: number): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const query = `
        SELECT 
          i.id, i.session_id, i.candidate_name, i.candidate_email, i.candidate_phone,
          i.start_time, i.end_time, i.duration, i.score, i.total_questions, i.correct_answers,
          i.time_spent, i.strengths, i.areas_for_improvement, i.overall_feedback,
          i.detailed_answers, i.question_analysis, i.created_at, i.updated_at
        FROM interviews i
        LEFT JOIN interview_links il ON i.interview_link_id = il.id
        WHERE il.created_by = ? OR i.interview_link_id IS NULL
        ORDER BY i.created_at DESC
      `;

            this.db.all(query, [interviewerId], (err, rows) => {
                if (err) {
                    console.error('Error fetching interviews:', err);
                    reject(err);
                } else {
                    // Parse JSON fields
                    const parsedRows = rows.map((row: any) => ({
                        ...row,
                        strengths: row.strengths ? JSON.parse(row.strengths) : [],
                        areasForImprovement: row.areas_for_improvement ? JSON.parse(row.areas_for_improvement) : [],
                        detailedAnswers: row.detailed_answers ? JSON.parse(row.detailed_answers) : [],
                        questionAnalysis: row.question_analysis ? JSON.parse(row.question_analysis) : []
                    }));
                    resolve(parsedRows);
                }
            });
        });
    }

    public async getInterviewsByCandidate(candidateEmail: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            console.log('=== DATABASE SERVICE DEBUG ===');
            console.log('Querying interviews for candidate email:', candidateEmail);
            
            const query = `
        SELECT 
          i.id, i.session_id, i.candidate_name, i.candidate_email, i.candidate_phone,
          i.start_time, i.end_time, i.duration, i.score, i.total_questions, i.correct_answers,
          i.time_spent, i.strengths, i.areas_for_improvement, i.overall_feedback,
          i.detailed_answers, i.question_analysis, i.created_at, i.updated_at,
          il.title, il.description
        FROM interviews i
        LEFT JOIN interview_links il ON i.interview_link_id = il.id
        WHERE i.candidate_email = ?
        ORDER BY i.created_at DESC
      `;

            console.log('Executing query:', query);
            console.log('With parameters:', [candidateEmail]);

            this.db.all(query, [candidateEmail], (err, rows) => {
                if (err) {
                    console.error('Database error fetching interviews by candidate:', err);
                    reject(err);
                } else {
                    console.log('Database returned', rows.length, 'rows');
                    console.log('Sample raw row:', rows.slice(0, 1));
                    
                    // Parse JSON fields
                    const parsedRows = rows.map((row: any) => ({
                        ...row,
                        strengths: row.strengths ? JSON.parse(row.strengths) : [],
                        areasForImprovement: row.areas_for_improvement ? JSON.parse(row.areas_for_improvement) : [],
                        detailedAnswers: row.detailed_answers ? JSON.parse(row.detailed_answers) : [],
                        questionAnalysis: row.question_analysis ? JSON.parse(row.question_analysis) : []
                    }));
                    
                    console.log('Parsed rows count:', parsedRows.length);
                    console.log('Sample parsed row:', parsedRows.slice(0, 1));
                    console.log('=== END DATABASE SERVICE DEBUG ===');
                    
                    resolve(parsedRows);
                }
            });
        });
    }

    public async getInterviewById(id: number): Promise<any> {
        return new Promise((resolve, reject) => {
            const query = `
        SELECT 
          id, session_id, candidate_name, candidate_email, candidate_phone,
          start_time, end_time, duration, score, total_questions, correct_answers,
          time_spent, strengths, areas_for_improvement, overall_feedback,
          detailed_answers, question_analysis, created_at, updated_at
        FROM interviews 
        WHERE id = ?
      `;

            this.db.get(query, [id], (err, row: any) => {
                if (err) {
                    console.error('Error fetching interview:', err);
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    // Parse JSON fields
                    const parsedRow = {
                        ...row,
                        strengths: row.strengths ? JSON.parse(row.strengths) : [],
                        areasForImprovement: row.areas_for_improvement ? JSON.parse(row.areas_for_improvement) : [],
                        detailedAnswers: row.detailed_answers ? JSON.parse(row.detailed_answers) : [],
                        questionAnalysis: row.question_analysis ? JSON.parse(row.question_analysis) : []
                    };
                    resolve(parsedRow);
                }
            });
        });
    }

    public async verifyInterviewerAccess(interviewId: number, interviewerId: number): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const query = `
        SELECT COUNT(*) as count
        FROM interviews i
        LEFT JOIN interview_links il ON i.interview_link_id = il.id
        WHERE i.id = ? AND (il.created_by = ? OR i.interview_link_id IS NULL)
      `;

            this.db.get(query, [interviewId, interviewerId], (err, row: any) => {
                if (err) {
                    console.error('Error verifying interviewer access:', err);
                    reject(err);
                } else {
                    resolve(row.count > 0);
                }
            });
        });
    }

    public async authenticateAdmin(username: string, password: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const bcrypt = require('bcryptjs');

            this.db.get(
                'SELECT password_hash FROM admin_users WHERE username = ?',
                [username],
                (err, row: any) => {
                    if (err) {
                        console.error('Error authenticating admin:', err);
                        reject(err);
                    } else if (!row) {
                        resolve(false);
                    } else {
                        const isValid = bcrypt.compareSync(password, row.password_hash);
                        if (isValid) {
                            // Update last login
                            this.db.run(
                                'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE username = ?',
                                [username]
                            );
                        }
                        resolve(isValid);
                    }
                }
            );
        });
    }

    // Session management methods removed - using interviews table for all data storage

    // User management methods
    public async createUser(userData: {
        email: string;
        passwordHash: string;
        fullName: string;
        userType: 'candidate' | 'interviewer';
        phone?: string;
        company?: string;
    }): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO users (email, password_hash, full_name, user_type, phone, company)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userData.email, userData.passwordHash, userData.fullName, userData.userType, userData.phone || null, userData.company || null],
                function (err) {
                    if (err) {
                        console.error('Error creating user:', err);
                        reject(err);
                    } else {
                        console.log('User created successfully with ID:', this.lastID);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    public async getUserByEmail(email: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE email = ?',
                [email],
                (err, row) => {
                    if (err) {
                        console.error('Error fetching user:', err);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    public async getUserById(id: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, email, full_name, user_type, phone, company, created_at, last_login, is_active FROM users WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) {
                        console.error('Error fetching user by ID:', err);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    public async updateUserLastLogin(userId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [userId],
                (err) => {
                    if (err) {
                        console.error('Error updating last login:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // Interview link management methods
    public async createInterviewLink(linkData: {
        createdBy: number;
        linkToken: string;
        title: string;
        description?: string;
        expiryDate?: string;
        maxAttempts?: number;
    }): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO interview_links (created_by, link_token, title, description, expiry_date, max_attempts)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    linkData.createdBy,
                    linkData.linkToken,
                    linkData.title,
                    linkData.description || null,
                    linkData.expiryDate || null,
                    linkData.maxAttempts || 0
                ],
                function (err) {
                    if (err) {
                        console.error('Error creating interview link:', err);
                        reject(err);
                    } else {
                        console.log('Interview link created successfully with ID:', this.lastID);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    public async getInterviewLinkByToken(token: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT il.*, u.full_name as creator_name, u.email as creator_email 
                 FROM interview_links il
                 LEFT JOIN users u ON il.created_by = u.id
                 WHERE il.link_token = ?`,
                [token],
                (err, row) => {
                    if (err) {
                        console.error('Error fetching interview link:', err);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    public async getInterviewLinksByUser(userId: number): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT il.*, 
                 (SELECT COUNT(*) FROM interviews WHERE interview_link_id = il.id) as total_attempts,
                 (SELECT COUNT(*) FROM interviews WHERE interview_link_id = il.id AND end_time IS NOT NULL) as completed_interviews
                 FROM interview_links il
                 WHERE il.created_by = ?
                 ORDER BY il.created_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) {
                        console.error('Error fetching interview links:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    public async updateInterviewLink(linkId: number, updates: {
        title?: string;
        description?: string;
        isActive?: boolean;
        expiryDate?: string;
        maxAttempts?: number;
    }): Promise<void> {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.title !== undefined) {
                fields.push('title = ?');
                values.push(updates.title);
            }
            if (updates.description !== undefined) {
                fields.push('description = ?');
                values.push(updates.description);
            }
            if (updates.isActive !== undefined) {
                fields.push('is_active = ?');
                values.push(updates.isActive ? 1 : 0);
            }
            if (updates.expiryDate !== undefined) {
                fields.push('expiry_date = ?');
                values.push(updates.expiryDate);
            }
            if (updates.maxAttempts !== undefined) {
                fields.push('max_attempts = ?');
                values.push(updates.maxAttempts);
            }

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(linkId);

            this.db.run(
                `UPDATE interview_links SET ${fields.join(', ')} WHERE id = ?`,
                values,
                (err) => {
                    if (err) {
                        console.error('Error updating interview link:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    public async deleteInterviewLink(linkId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM interview_links WHERE id = ?',
                [linkId],
                (err) => {
                    if (err) {
                        console.error('Error deleting interview link:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    public async getInterviewLinkById(linkId: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT il.*, u.full_name as creator_name, u.email as creator_email 
                 FROM interview_links il
                 LEFT JOIN users u ON il.created_by = u.id
                 WHERE il.id = ?`,
                [linkId],
                (err, row) => {
                    if (err) {
                        console.error('Error fetching interview link:', err);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    public async getCandidatesByInterviewLink(linkId: number): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT i.*, u.full_name, u.email
                 FROM interviews i
                 LEFT JOIN users u ON i.user_id = u.id
                 WHERE i.interview_link_id = ?
                 ORDER BY i.created_at DESC`,
                [linkId],
                (err, rows) => {
                    if (err) {
                        console.error('Error fetching candidates:', err);
                        reject(err);
                    } else {
                        const parsedRows = rows.map((row: any) => ({
                            ...row,
                            strengths: row.strengths ? JSON.parse(row.strengths) : [],
                            areasForImprovement: row.areas_for_improvement ? JSON.parse(row.areas_for_improvement) : [],
                            detailedAnswers: row.detailed_answers ? JSON.parse(row.detailed_answers) : [],
                            questionAnalysis: row.question_analysis ? JSON.parse(row.question_analysis) : []
                        }));
                        resolve(parsedRows);
                    }
                }
            );
        });
    }

    // Resume management methods
    public async getUserResume(userId: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT resume_data FROM users WHERE id = ?',
                [userId],
                (err, row: any) => {
                    if (err) {
                        console.error('Error fetching user resume:', err);
                        reject(err);
                    } else {
                        resolve(row?.resume_data ? JSON.parse(row.resume_data) : null);
                    }
                }
            );
        });
    }

    public async updateUserResume(userId: number, resumeData: any): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('=== DATABASE UPDATE USER RESUME ===');
            console.log('User ID:', userId);
            console.log('Resume data keys:', Object.keys(resumeData || {}));
            
            this.db.run(
                'UPDATE users SET resume_data = ? WHERE id = ?',
                [JSON.stringify(resumeData), userId],
                function (err) {
                    if (err) {
                        console.error('❌ Error updating user resume:', err);
                        reject(err);
                    } else {
                        console.log('✅ User resume updated successfully, changes:', this.changes);
                        resolve();
                    }
                }
            );
        });
    }

    // clearUserSessions method removed - no longer needed without sessions table

    public async updateCheatingDetection(sessionId: string, data: {
        cheatingDetected: boolean;
        cheatingIncidents: any[];
        securityAgentConnected: boolean;
    }): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('=== UPDATE CHEATING DETECTION ===');
            console.log('Session ID:', sessionId);
            console.log('Cheating detected:', data.cheatingDetected);
            console.log('Incidents count:', data.cheatingIncidents.length);
            console.log('Security agent connected:', data.securityAgentConnected);

            const query = `
                UPDATE interviews 
                SET cheating_detected = ?, 
                    cheating_incidents = ?, 
                    security_agent_connected = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE session_id = ?
            `;

            const values = [
                data.cheatingDetected ? 1 : 0,
                JSON.stringify(data.cheatingIncidents),
                data.securityAgentConnected ? 1 : 0,
                sessionId
            ];

            this.db.run(query, values, function (err) {
                if (err) {
                    console.error('❌ Error updating cheating detection:', err);
                    reject(err);
                } else {
                    console.log(`✅ Cheating detection updated for session ${sessionId}, changes: ${this.changes}`);
                    resolve();
                }
            });
        });
    }

    private addCheatingDetectionColumns(): void {
        // Add cheating_detected column if it doesn't exist
        this.db.run(`
            ALTER TABLE interviews ADD COLUMN cheating_detected BOOLEAN DEFAULT 0
        `, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding cheating_detected column:', err);
            } else if (!err) {
                console.log('Added cheating_detected column to interviews table');
            }
        });

        // Add cheating_incidents column if it doesn't exist
        this.db.run(`
            ALTER TABLE interviews ADD COLUMN cheating_incidents TEXT
        `, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding cheating_incidents column:', err);
            } else if (!err) {
                console.log('Added cheating_incidents column to interviews table');
            }
        });

        // Add security_agent_connected column if it doesn't exist
        this.db.run(`
            ALTER TABLE interviews ADD COLUMN security_agent_connected BOOLEAN DEFAULT 0
        `, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding security_agent_connected column:', err);
            } else if (!err) {
                console.log('Added security_agent_connected column to interviews table');
            }
        });
    }

    public close(): void {
        this.db.close();
    }
}
