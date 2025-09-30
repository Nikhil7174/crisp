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
        // Create interviews table
        // Create sessions table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        candidate_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        questions TEXT,
        answers TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration INTEGER,
        score INTEGER,
        summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) {
                console.error('Error creating sessions table:', err);
            } else {
                console.log('Sessions table created successfully');
            }
        });

        this.db.run(`
      CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) {
                console.error('Error creating interviews table:', err);
            } else {
                console.log('Interviews table created successfully');
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
            console.log('saveInterviewSummary called with:', JSON.stringify(summary, null, 2));

            const query = `
        INSERT OR REPLACE INTO interviews (
          session_id, candidate_name, candidate_email, candidate_phone,
          start_time, end_time, duration, score, total_questions, correct_answers,
          time_spent, strengths, areas_for_improvement, overall_feedback,
          detailed_answers, question_analysis, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

            const values = [
                summary.sessionId,
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
                JSON.stringify(summary.questionAnalysis)
            ];

            console.log('SQL Query:', query);
            console.log('Values:', values);
            console.log('About to execute database query...');

            this.db.run(query, values, function (err) {
                if (err) {
                    console.error('❌ Database error saving interview summary:', err);
                    console.error('Error details:', JSON.stringify(err, null, 2));
                    reject(err);
                } else {
                    console.log(`✅ Interview summary saved for session ${summary.sessionId}`);
                    console.log('Database operation completed successfully');
                }
                console.log('=== END DATABASE SERVICE DEBUG ===');
                resolve();
            });
        });
    }

    public async getAllInterviews(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const query = `
        SELECT 
          id, session_id, candidate_name, candidate_email, candidate_phone,
          start_time, end_time, duration, score, total_questions, correct_answers,
          time_spent, strengths, areas_for_improvement, overall_feedback,
          detailed_answers, question_analysis, created_at, updated_at
        FROM interviews 
        ORDER BY created_at DESC
      `;

            this.db.all(query, [], (err, rows) => {
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

    // Session management methods
    public async saveSession(sessionData: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const { sessionId, candidateId, status, questions, answers, startTime, endTime, duration, score, summary } = sessionData;

            this.db.run(
                `INSERT OR REPLACE INTO sessions 
                 (session_id, candidate_id, status, questions, answers, start_time, end_time, duration, score, summary, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    sessionId,
                    candidateId || null,
                    status || 'pending',
                    JSON.stringify(questions || []),
                    JSON.stringify(answers || []),
                    startTime,
                    endTime || null,
                    duration || null,
                    score || null,
                    summary || null
                ],
                function (err) {
                    if (err) {
                        console.error('Error saving session:', err);
                        reject(err);
                    } else {
                        console.log('Session saved successfully');
                        resolve();
                    }
                }
            );
        });
    }

    public async getSession(sessionId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM sessions WHERE session_id = ?',
                [sessionId],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (!row) {
                        resolve(null);
                        return;
                    }

                    // Parse JSON fields
                    const session = {
                        ...row,
                        questions: row.questions ? JSON.parse(row.questions) : [],
                        answers: row.answers ? JSON.parse(row.answers) : []
                    };
                    resolve(session);
                }
            );
        });
    }

    public async updateSession(sessionId: string, updates: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            Object.keys(updates).forEach(key => {
                if (key === 'questions' || key === 'answers') {
                    fields.push(`${key} = ?`);
                    values.push(JSON.stringify(updates[key]));
                } else {
                    fields.push(`${key} = ?`);
                    values.push(updates[key]);
                }
            });

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(sessionId);

            this.db.run(
                `UPDATE sessions SET ${fields.join(', ')} WHERE session_id = ?`,
                values,
                function (err) {
                    if (err) {
                        console.error('Error updating session:', err);
                        reject(err);
                    } else {
                        console.log('Session updated successfully');
                        resolve();
                    }
                }
            );
        });
    }

    public close(): void {
        this.db.close();
    }
}
