-- Migration to separate question tables for better performance
-- This will create separate tables for theoretical and machine coding questions

-- Create theoretical questions table
CREATE TABLE theoretical_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  question_text TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category TEXT NOT NULL,
  
  -- Long-form answer fields
  expected_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  key_points TEXT, -- JSON array
  documentation TEXT, -- JSON array
  
  -- Metadata
  companies TEXT, -- JSON array
  tags TEXT, -- JSON array  
  success_rate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create machine coding questions table
CREATE TABLE machine_coding_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  question_text TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category TEXT NOT NULL,
  
  -- Coding-specific fields
  language TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  constraints TEXT, -- JSON array
  examples TEXT, -- JSON array
  starter_code TEXT,
  test_cases TEXT NOT NULL, -- JSON array
  hints TEXT, -- JSON array
  solution TEXT, -- JSON object
  time_complexity TEXT,
  space_complexity TEXT,
  
  -- Metadata
  companies TEXT, -- JSON array
  similar_to TEXT,
  tags TEXT, -- JSON array
  success_rate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_theoretical_topic_difficulty ON theoretical_questions(topic, difficulty);
CREATE INDEX idx_theoretical_category ON theoretical_questions(category);
CREATE INDEX idx_theoretical_tags ON theoretical_questions(tags);

CREATE INDEX idx_machine_coding_topic_difficulty ON machine_coding_questions(topic, difficulty);
CREATE INDEX idx_machine_coding_category ON machine_coding_questions(category);
CREATE INDEX idx_machine_coding_language ON machine_coding_questions(language);
CREATE INDEX idx_machine_coding_tags ON machine_coding_questions(tags);

-- Migrate existing data
INSERT INTO theoretical_questions (
  topic, question_text, difficulty, category,
  expected_answer, explanation, key_points, documentation,
  companies, tags, success_rate, created_at, updated_at
)
SELECT 
  topic, question_text, difficulty, category,
  correct_answer, explanation, 
  NULL as key_points, NULL as documentation,
  companies, tags, success_rate, created_at, updated_at
FROM question_bank 
WHERE question_type = 'theoretical';

INSERT INTO machine_coding_questions (
  topic, question_text, difficulty, category,
  language, problem_statement, constraints, examples,
  starter_code, test_cases, hints, solution,
  time_complexity, space_complexity,
  companies, similar_to, tags, success_rate, created_at, updated_at
)
SELECT 
  topic, question_text, difficulty, category,
  language, problem_statement, constraints, examples,
  starter_code, test_cases, hints, solution,
  time_complexity, space_complexity,
  companies, similar_to, tags, success_rate, created_at, updated_at
FROM question_bank 
WHERE question_type = 'machine_coding';



