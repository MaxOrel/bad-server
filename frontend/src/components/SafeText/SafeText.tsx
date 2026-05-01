import React from 'react';
import { sanitizeInput } from '../../utils/sanitize';

interface SafeTextProps {
    text: string | null | undefined;
    as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    className?: string;
}

export const SafeText: React.FC<SafeTextProps> = ({ 
    text, 
    as: Component = 'span',
    className 
}) => {
    const sanitizedText = sanitizeInput(text);
    
    return React.createElement(Component, {
        className,
        children: sanitizedText
    });
};