import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface OCRResult {
  id: string;
  imageUri: string;
  extractedText: string;
  confidence: number;
  language?: string;
  processedAt: string;
}

export interface OCRError {
  code: string;
  message: string;
  imageUri?: string;
}

interface OCRContextType {
  results: OCRResult[];
  loading: boolean;
  error: OCRError | null;
  processImage: (imageUri: string) => Promise<OCRResult>;
  clearResults: () => void;
  getResultById: (id: string) => OCRResult | undefined;
}

const OCRContext = createContext<OCRContextType | undefined>(undefined);

interface OCRProviderProps {
  children: ReactNode;
}

export const OCRProvider: React.FC<OCRProviderProps> = ({ children }) => {
  const [results, setResults] = useState<OCRResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<OCRError | null>(null);

  const processImage = async (imageUri: string): Promise<OCRResult> => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement actual OCR processing
      // This would typically involve calling a service like Google Vision API,
      // AWS Textract, or a similar OCR service
      
      // Mock implementation for now
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
      
      const mockResult: OCRResult = {
        id: `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        imageUri,
        extractedText: 'Sample extracted text - OCR not yet implemented',
        confidence: 0.85,
        language: 'en',
        processedAt: new Date().toISOString(),
      };

      setResults(prev => [...prev, mockResult]);
      return mockResult;
    } catch (err) {
      const ocrError: OCRError = {
        code: 'OCR_PROCESSING_FAILED',
        message: err instanceof Error ? err.message : 'Failed to process image',
        imageUri,
      };
      setError(ocrError);
      throw ocrError;
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setError(null);
  };

  const getResultById = (id: string): OCRResult | undefined => {
    return results.find(result => result.id === id);
  };

  const value: OCRContextType = {
    results,
    loading,
    error,
    processImage,
    clearResults,
    getResultById,
  };

  return (
    <OCRContext.Provider value={value}>
      {children}
    </OCRContext.Provider>
  );
};

export const useOCR = (): OCRContextType => {
  const context = useContext(OCRContext);
  if (!context) {
    throw new Error('useOCR must be used within an OCRProvider');
  }
  return context;
};