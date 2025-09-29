import { Request, Response } from 'express';
import { ResumeParserService, DetailedResumeData } from '../services/resumeParserService';

export class UploadController {
  private resumeParser: ResumeParserService;
  
  constructor() {
    this.resumeParser = new ResumeParserService();
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
      
      // Update the resume data with collected information
      const completeResumeData = {
        ...resumeData,
        name,
        email,
        phone
      };
      
      const completeDetailedResumeData = {
        ...resumeData,
        name,
        email,
        phone,
        personalInfo: {
          ...resumeData.personalInfo,
          name,
          email,
          phone
        }
      };
      
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
