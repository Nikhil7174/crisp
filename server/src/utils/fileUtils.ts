export const validateFileType = (fileName: string): boolean => {
  const allowedExtensions = ['.pdf', '.docx'];
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return allowedExtensions.includes(extension);
};

export const validateFileSize = (fileSize: number, maxSize: number = 10485760): boolean => {
  return fileSize <= maxSize;
};

export const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
};

export const getFileExtension = (fileName: string): string => {
  return fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
};
