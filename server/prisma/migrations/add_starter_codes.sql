-- Migration to add starter_codes field to machine_coding_questions table
-- This field stores starter code for multiple languages as JSON

ALTER TABLE machine_coding_questions 
ADD COLUMN starter_codes TEXT;


