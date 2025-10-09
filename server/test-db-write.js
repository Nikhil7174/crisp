const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'interviews.db');
const db = new sqlite3.Database(dbPath);

console.log('🧪 Testing Database Write Operations...\n');

// Test 1: Save a session
console.log('📝 Test 1: Saving a session...');
const sessionData = {
    sessionId: 'test_session_123',
    candidateId: 'test@example.com',
    status: 'completed',
    questions: [{ id: 'q1', question: 'Test question' }],
    answers: [{ questionId: 'q1', answer: 'Test answer' }],
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    duration: 300000,
    score: 85
};

// Sessions table removed - using interviews table for all data storage
console.log('ℹ️  Sessions table removed - using interviews table for all data storage');

// Test 2: Save an interview summary
console.log('\n📊 Test 2: Saving interview summary...');
const interviewSummary = {
    sessionId: 'test_session_123',
    candidateName: 'Test User',
    candidateEmail: 'test@example.com',
    candidatePhone: '1234567890',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    duration: 300000,
    score: 85,
    totalQuestions: 6,
    correctAnswers: 5,
    timeSpent: 300,
    strengths: ['Good problem solving'],
    areasForImprovement: ['Need more practice'],
    overallFeedback: 'Good performance',
    detailedAnswers: [],
    questionAnalysis: {}
};

const query = `
    INSERT OR REPLACE INTO interviews (
      session_id, candidate_name, candidate_email, candidate_phone,
      start_time, end_time, duration, score, total_questions, correct_answers,
      time_spent, strengths, areas_for_improvement, overall_feedback,
      detailed_answers, question_analysis, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`;

const values = [
    interviewSummary.sessionId,
    interviewSummary.candidateName,
    interviewSummary.candidateEmail,
    interviewSummary.candidatePhone,
    interviewSummary.startTime,
    interviewSummary.endTime,
    interviewSummary.duration,
    interviewSummary.score,
    interviewSummary.totalQuestions,
    interviewSummary.correctAnswers,
    interviewSummary.timeSpent,
    JSON.stringify(interviewSummary.strengths),
    JSON.stringify(interviewSummary.areasForImprovement),
    interviewSummary.overallFeedback,
    JSON.stringify(interviewSummary.detailedAnswers),
    JSON.stringify(interviewSummary.questionAnalysis)
];

db.run(query, values, function(err) {
    if (err) {
        console.error('❌ Error saving interview summary:', err);
    } else {
        console.log('✅ Interview summary saved successfully!');
    }
    
    // Test 3: Verify data was saved
    console.log('\n🔍 Test 3: Verifying saved data...');
    // Sessions table removed - using interviews table for all data storage
    console.log('ℹ️  Sessions table removed - using interviews table for all data storage');
    
    db.all('SELECT COUNT(*) as count FROM interviews', (err, rows) => {
        if (err) {
            console.error('❌ Error counting interviews:', err);
        } else {
            console.log(`📊 Interviews count: ${rows[0].count}`);
        }
        
        // Close database connection
        db.close();
    });
});
