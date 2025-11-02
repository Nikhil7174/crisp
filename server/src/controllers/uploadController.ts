import { Request, Response } from 'express';
import { ResumeParserService, DetailedResumeData } from '../services/resumeParserService';
import { PrismaService } from '../services/prismaService';

export class UploadController {
  private resumeParser: ResumeParserService;
  private dbService: PrismaService;
  
  constructor() {
    this.resumeParser = new ResumeParserService();
    this.dbService = PrismaService.getInstance();
  }
  
  async uploadResume(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      
      const { buffer, originalname } = req.file;
      
      // Parse the resume using AI
      const detailedResumeData: DetailedResumeData = await this.resumeParser.parseResume(buffer, originalname);
      
      // Check if we have the essential information (name, email, phone)
      const missingFields = [];
      if (!detailedResumeData.name) missingFields.push('name');
      if (!detailedResumeData.email) missingFields.push('email');
      if (!detailedResumeData.phone) missingFields.push('phone');
      
      // Create resumeData for backward compatibility
      const resumeData = {
        name: detailedResumeData.name,
        email: detailedResumeData.email,
        phone: detailedResumeData.phone,
        text: detailedResumeData.text,
        fileName: detailedResumeData.fileName
      };
      
      // Prepare response with both formats
      const response = {
        success: true,
        resumeData,
        detailedResumeData,
        missingFields,
        message: missingFields.length > 0 
          ? `Please provide: ${missingFields.join(', ')}`
          : 'Resume parsed successfully with all details!'
      };
      
      res.json(response);
      
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        error: 'Failed to process resume',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  async collectMissingInfo(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, phone, resumeData } = req.body;
      const userId = (req as any).user?.userId; // Get user ID if authenticated
      
      console.log('=== COLLECT INFO DEBUG ===');
      console.log('User ID:', userId);
      console.log('Request body keys:', Object.keys(req.body));
      console.log('Has resumeData:', !!resumeData);
      
      if (!name || !email || !phone) {
        res.status(400).json({ error: 'Name, email, and phone are required' });
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
      
      // Validate phone format
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        res.status(400).json({ error: 'Invalid phone format' });
        return;
      }
      
      // Handle case where resumeData might be null or missing personalInfo
      const safeResumeData = resumeData || {};
      const safePersonalInfo = safeResumeData.personalInfo || {};
      
      // Update the resume data with collected information
      const completeResumeData = {
        ...safeResumeData,
        name,
        email,
        phone
      };
      
      const completeDetailedResumeData = {
        ...safeResumeData,
        name,
        email,
        phone,
        personalInfo: {
          ...safePersonalInfo,
          name,
          email,
          phone
        },
        // Ensure other required fields exist
        experience: safeResumeData.experience || { internships: [], projects: [], awards: [] },
        technicalSkills: safeResumeData.technicalSkills || { languages: [], frameworks: [], tools: [], databases: [], other: [] }
      };
      
      // Save resume data to user profile if user is authenticated
      if (userId) {
        try {
          console.log('Attempting to save resume data for user:', userId);
          await this.dbService.updateUserResume(userId, completeResumeData);
          console.log('✅ Resume data saved to user profile for user:', userId);
        } catch (error) {
          console.error('❌ Failed to save resume data to user profile:', error);
          // Don't fail the request if resume saving fails
        }
      } else {
        console.log('⚠️ No user ID found - resume data not saved to profile');
      }
      
      res.json({
        success: true,
        resumeData: completeResumeData,
        detailedResumeData: completeDetailedResumeData,
        message: 'Candidate information collected successfully'
      });
      
    } catch (error) {
      console.error('Collect info error:', error);
      res.status(500).json({ 
        error: 'Failed to collect information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
