import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import OpenAI from 'openai';
import { ResumeData } from '../models/types';

export interface DetailedResumeData extends ResumeData {
  personalInfo: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    college?: string | null;
    batch?: string | null;
    branch?: string | null;
    degree?: string | null;
    cgpa?: string | null;
  };
  experience: {
    internships?: Array<{
      company: string;
      role: string;
      duration: string;
      description: string;
    }>;
    projects?: Array<{
      name: string;
      description: string;
      technologies: string[];
      duration: string;
    }>;
    awards?: Array<{
      title: string;
      organization: string;
      year: string;
      description: string;
    }>;
  };
  technicalSkills: {
    languages?: string[];
    frameworks?: string[];
    tools?: string[];
    databases?: string[];
    other?: string[];
  };
}

export class ResumeParserService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async parseResume(fileBuffer: Buffer, fileName: string): Promise<DetailedResumeData> {
    const fileExtension = fileName.toLowerCase().split('.').pop();

    let text: string;

    if (fileExtension === 'pdf') {
      text = await this.parsePDF(fileBuffer);
    } else if (fileExtension === 'docx') {
      text = await this.parseDOCX(fileBuffer);
    } else {
      throw new Error('Unsupported file type. Only PDF and DOCX files are allowed.');
    }

    // Use OpenAI to extract structured data
    const extractedData = await this.extractDataWithAI(text);

    return {
      ...extractedData,
      text,
      fileName
    };
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error('Failed to parse PDF file');
    }
  }

  private async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error('Failed to parse DOCX file');
    }
  }

  private async extractDataWithAI(text: string): Promise<DetailedResumeData> {
    // MOCK DATA - Remove this when OpenAI is configured
    console.log('Using MOCK resume parsing data (OpenAI not configured)');

    // Generate mock data based on some basic text analysis
    const mockData = this.generateMockResumeData(text);
    return mockData;

    /* ORIGINAL OPENAI CODE - Uncomment when OpenAI is configured
    try {
      const prompt = `Extract structured information from this resume text. Return ONLY a valid JSON object with the following structure. If any information is not available, set it to null or empty array/string.

Resume Text:
${text.substring(0, 4000)} // Limit to avoid token limits

Required JSON Structure:
{
  "personalInfo": {
    "name": "string or null",
    "email": "string or null", 
    "phone": "string or null",
    "college": "string or null",
    "batch": "string or null",
    "branch": "string or null", 
    "degree": "string or null",
    "cgpa": "string or null"
  },
  "experience": {
    "internships": [
      {
        "company": "string",
        "role": "string", 
        "duration": "string",
        "description": "string"
      }
    ],
    "projects": [
      {
        "name": "string",
        "description": "string",
        "technologies": ["string"],
        "duration": "string"
      }
    ],
    "awards": [
      {
        "title": "string",
        "organization": "string",
        "year": "string", 
        "description": "string"
      }
    ]
  },
  "technicalSkills": {
    "languages": ["string"],
    "frameworks": ["string"],
    "tools": ["string"],
    "databases": ["string"],
    "other": ["string"]
  }
}

Extract all available information accurately. For arrays, return empty array [] if no items found. For strings, return null if not found.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert resume parser. Extract structured information from resume text and return only valid JSON. Do not include any text outside the JSON object.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const extractedData = JSON.parse(content);
      
      // Log extracted data for debugging
      console.log('AI Extracted Data:', JSON.stringify(extractedData, null, 2));
      
      // Return the structured data
      return {
        name: extractedData.personalInfo?.name || null,
        email: extractedData.personalInfo?.email || null,
        phone: extractedData.personalInfo?.phone || null,
        text: text, // Keep original text
        fileName: '', // Will be set by caller
        personalInfo: extractedData.personalInfo || {},
        experience: extractedData.experience || { internships: [], projects: [], awards: [] },
        technicalSkills: extractedData.technicalSkills || { languages: [], frameworks: [], tools: [], databases: [], other: [] }
      };

    } catch (error) {
      console.error('Error extracting data with AI:', error);
      
      // Fallback to basic extraction if AI fails
      return this.fallbackExtraction(text);
    }
    */
  }

  private generateMockResumeData(text: string): DetailedResumeData {
    // Basic regex extraction for essential fields
    const emailRegex = /\b[A-Za-z0-9]([A-Za-z0-9._%-]*[A-Za-z0-9])?@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b/g;
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;

    const emails = text.match(emailRegex) || [];
    const phones = text.match(phoneRegex) || [];

    // Simple name extraction from first line
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const name = lines[0] && this.isLikelyName(lines[0]) ? lines[0] : 'John Doe';

    // Mock data with some realistic values
    const mockPersonalInfo = {
      name: name,
      email: emails[0] || 'john.doe@email.com',
      phone: phones[0] || '+1 (555) 123-4567',
      college: 'University of Technology',
      batch: '2024',
      branch: 'Computer Science',
      degree: 'Bachelor of Technology',
      cgpa: '8.5'
    };

    const mockExperience = {
      internships: [
        {
          company: 'Tech Solutions Inc.',
          role: 'Software Development Intern',
          duration: '3 months',
          description: 'Developed web applications using React and Node.js'
        },
        {
          company: 'DataCorp',
          role: 'Data Science Intern',
          duration: '2 months',
          description: 'Worked on machine learning models for data analysis'
        }
      ],
      projects: [
        {
          name: 'E-commerce Platform',
          description: 'Full-stack web application with user authentication and payment integration',
          technologies: ['React', 'Node.js', 'MongoDB', 'Stripe API'],
          duration: '4 months'
        },
        {
          name: 'Task Management App',
          description: 'Mobile-responsive task management application with real-time updates',
          technologies: ['React', 'Express.js', 'Socket.io', 'PostgreSQL'],
          duration: '2 months'
        }
      ],
      awards: [
        {
          title: 'Best Project Award',
          organization: 'University Tech Fest',
          year: '2023',
          description: 'Awarded for innovative e-commerce platform design'
        }
      ]
    };

    const mockTechnicalSkills = {
      languages: ['JavaScript', 'Python', 'Java', 'C++'],
      frameworks: ['React', 'Node.js', 'Express.js', 'Django'],
      tools: ['Git', 'Docker', 'VS Code', 'Postman'],
      databases: ['MongoDB', 'PostgreSQL', 'MySQL'],
      other: ['AWS', 'REST APIs', 'GraphQL', 'Jest']
    };

    return {
      name: mockPersonalInfo.name,
      email: mockPersonalInfo.email,
      phone: mockPersonalInfo.phone,
      text: text,
      fileName: '',
      personalInfo: mockPersonalInfo,
      experience: mockExperience,
      technicalSkills: mockTechnicalSkills
    };
  }

  private fallbackExtraction(text: string): DetailedResumeData {
    // Basic regex fallback for essential fields only
    const emailRegex = /\b[A-Za-z0-9]([A-Za-z0-9._%-]*[A-Za-z0-9])?@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b/g;
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;

    const emails = text.match(emailRegex) || [];
    const phones = text.match(phoneRegex) || [];

    // Simple name extraction from first line
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const name = lines[0] && this.isLikelyName(lines[0]) ? lines[0] : null;

    return {
      name: name,
      email: emails[0] || null,
      phone: phones[0] || null,
      text: text,
      fileName: '',
      personalInfo: {
        name: name,
        email: emails[0] || null,
        phone: phones[0] || null,
        college: null,
        batch: null,
        branch: null,
        degree: null,
        cgpa: null
      },
      experience: {
        internships: [],
        projects: [],
        awards: []
      },
      technicalSkills: {
        languages: [],
        frameworks: [],
        tools: [],
        databases: [],
        other: []
      }
    };
  }

  private isLikelyName(text: string): boolean {
    if (!text || text.length < 2 || text.length > 50) return false;
    if (/\d/.test(text)) return false;
    if (!/^[A-Z]/.test(text)) return false;
    if (!/^[A-Za-z\s\-'\.]+$/.test(text)) return false;

    const wordCount = text.split(/\s+/).length;
    return wordCount >= 1 && wordCount <= 4;
  }
}
